import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Transaction.name)
    private txModel: Model<TransactionDocument>,
  ) {}

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  private startOf(period: 'day' | 'week' | 'month'): Date {
    const d = new Date();
    if (period === 'day') { d.setHours(0, 0, 0, 0); }
    else if (period === 'week') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
    else { d.setDate(1); d.setHours(0, 0, 0, 0); }
    return d;
  }

  // ─── DAILY / WEEKLY / MONTHLY SUMMARY ─────────────────────────────────────
  async getPeriodSummary(unitId: string | null, period: 'day' | 'week' | 'month') {
    const match: any = {
      type: TransactionType.SALE,
      timestamp: { $gte: this.startOf(period) },
    };
    if (unitId) match.unitId = new Types.ObjectId(unitId);

    const [result] = await this.txModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          transactions: { $sum: 1 },
          avgOrder: { $avg: '$total' },
        },
      },
    ]);
    return result ?? { revenue: 0, transactions: 0, avgOrder: 0 };
  }

  // ─── 30-DAY REVENUE TREND (daily buckets) ─────────────────────────────────
  async getRevenueTrend(unitId: string | null): Promise<{ date: string; revenue: number; transactions: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const match: any = {
      type: TransactionType.SALE,
      timestamp: { $gte: thirtyDaysAgo },
    };
    if (unitId) match.unitId = new Types.ObjectId(unitId);

    const raw = await this.txModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
          },
          revenue: { $sum: '$total' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Fill missing days with 0
    const map = new Map<string, { revenue: number; transactions: number }>();
    raw.forEach((r) => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}-${String(r._id.day).padStart(2, '0')}`;
      map.set(key, { revenue: r.revenue, transactions: r.transactions });
    });

    const result: { date: string; revenue: number; transactions: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({ date: key, ...(map.get(key) ?? { revenue: 0, transactions: 0 }) });
    }
    return result;
  }

  // ─── UNIT COMPARISON (Super Admin only) ───────────────────────────────────
  async getUnitComparison(): Promise<{ unitId: string; unitName: string; revenue: number; transactions: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    return this.txModel.aggregate([
      { $match: { type: TransactionType.SALE, timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: '$unitId',
          revenue: { $sum: '$total' },
          transactions: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: '_id',
          foreignField: '_id',
          as: 'unit',
        },
      },
      { $unwind: { path: '$unit', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          unitId: '$_id',
          unitName: { $ifNull: ['$unit.name', 'Unknown'] },
          revenue: 1,
          transactions: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]);
  }

  // ─── TOP PRODUCTS ─────────────────────────────────────────────────────────
  async getTopProducts(unitId: string | null, limit = 10): Promise<any[]> {
    const match: any = { type: TransactionType.SALE };
    if (unitId) match.unitId = new Types.ObjectId(unitId);

    return this.txModel.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.priceAtTime'] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ]);
  }

  // ─── MONTHLY REPORT ───────────────────────────────────────────────────────
  async getMonthlyReport(unitId: string | null): Promise<any[]> {
    const match: any = { type: TransactionType.SALE };
    if (unitId) match.unitId = new Types.ObjectId(unitId);

    return this.txModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } },
          revenue: { $sum: '$total' },
          transactions: { $sum: 1 },
          avgOrder: { $avg: '$total' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          revenue: 1,
          transactions: 1,
          avgOrder: 1,
        },
      },
    ]);
  }
}
