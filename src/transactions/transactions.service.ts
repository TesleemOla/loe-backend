import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from './schemas/transaction.schema';
import { ProductsService } from '../products/products.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
    private productsService: ProductsService,
    private eventsGateway: EventsGateway,
  ) {}

  // ─── CREATE SALE ────────────────────────────────────────────────────────────
  async createSale(
    unitId: string,
    userId: string,
    items: { productId: string; qty: number; overridePrice?: number }[],
    customerName?: string,
    amountPaid?: number,
  ): Promise<TransactionDocument> {
    if (!items || items.length === 0) {
      throw new BadRequestException('A sale must have at least one item');
    }

    // Resolve product details and snapshot prices at time of sale
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        const product = await this.productsService.findOne(item.productId, unitId);
        if (product.stock < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.qty}`,
          );
        }
        return {
          productId: new Types.ObjectId(item.productId),
          productName: product.name,
          qty: item.qty,
          priceAtTime: item.overridePrice !== undefined ? item.overridePrice : product.price,
        };
      }),
    );

    const total = resolvedItems.reduce((sum, i) => sum + i.priceAtTime * i.qty, 0);

    const tx = new this.txModel({
      unitId: new Types.ObjectId(unitId),
      type: TransactionType.SALE,
      items: resolvedItems,
      total,
      amountPaid: amountPaid !== undefined ? amountPaid : total,
      processedBy: new Types.ObjectId(userId),
      customerName: customerName || 'Guest',
      timestamp: new Date(),
    });

    const savedTx = await tx.save();

    // Update Unit-Specific Inventory
    await Promise.all(
      resolvedItems.map((item) =>
        this.productsService.updateStock(unitId, item.productId.toString(), -item.qty),
      ),
    );

    this.eventsGateway.broadcastNewTransaction(unitId, savedTx);
    this.eventsGateway.broadcastAnalyticsUpdate(unitId);
    return savedTx;
  }

  // ─── VOID SALE ──────────────────────────────────────────────────────────────
  async voidSale(
    originalTxId: string,
    unitId: string,
    userId: string,
  ): Promise<TransactionDocument> {
    const original = await this.txModel.findOne({
      _id: new Types.ObjectId(originalTxId),
      unitId: new Types.ObjectId(unitId),
      type: TransactionType.SALE,
    }).exec();

    if (!original) throw new NotFoundException('Original sale not found');

    // Check if any reversal already exists (Void OR Refund)
    const existingReversal = await this.txModel.findOne({ referenceId: original._id }).exec();
    if (existingReversal) {
      throw new BadRequestException(
        `This transaction has already been ${existingReversal.type.toLowerCase()}ed.`,
      );
    }

    const voidTx = new this.txModel({
      unitId: original.unitId,
      type: TransactionType.VOID,
      items: original.items,
      total: -original.total, // Negative to offset
      referenceId: original._id,
      processedBy: new Types.ObjectId(userId),
      timestamp: new Date(),
    });

    const savedTx = await voidTx.save();

    // Restore Unit-Specific Inventory
    await Promise.all(
      original.items.map((item) =>
        this.productsService.updateStock(unitId, item.productId.toString(), item.qty),
      ),
    );

    this.eventsGateway.broadcastNewTransaction(unitId, savedTx);
    this.eventsGateway.broadcastAnalyticsUpdate(unitId);
    return savedTx;
  }

  // ─── REFUND (PARTIAL) ────────────────────────────────────────────────────────
  async refundSale(
    originalTxId: string,
    unitId: string,
    userId: string,
    refundItems: { productId: string; qty: number }[],
  ): Promise<TransactionDocument> {
    const original = await this.txModel.findOne({
      _id: new Types.ObjectId(originalTxId),
      unitId: new Types.ObjectId(unitId),
      type: TransactionType.SALE,
    }).exec();

    if (!original) throw new NotFoundException('Original sale not found');

    // Check if any reversal already exists (Void OR Refund)
    const existingReversal = await this.txModel.findOne({ referenceId: original._id }).exec();
    if (existingReversal) {
      throw new BadRequestException(
        `This transaction has already been ${existingReversal.type.toLowerCase()}ed.`,
      );
    }

    const resolvedItems = refundItems.map((ri) => {
      const origItem = original.items.find(
        (oi) => oi.productId.toString() === ri.productId,
      );
      if (!origItem) throw new BadRequestException(`Product ${ri.productId} not in original sale`);
      if (ri.qty > origItem.qty) throw new BadRequestException(`Refund qty exceeds original qty`);
      
      const itemData = (origItem as any).toObject ? (origItem as any).toObject() : origItem;
      return { 
        ...itemData, 
        qty: ri.qty 
      };
    });

    const total = -(resolvedItems.reduce((s, i) => s + i.priceAtTime * i.qty, 0));

    const refundTx = new this.txModel({
      unitId: original.unitId,
      type: TransactionType.REFUND,
      items: resolvedItems,
      total,
      referenceId: original._id,
      processedBy: new Types.ObjectId(userId),
      timestamp: new Date(),
    });

    const savedTx = await refundTx.save();

    // Restore Unit-Specific Inventory for refunded quantities
    await Promise.all(
      resolvedItems.map((item) =>
        this.productsService.updateStock(unitId, item.productId.toString(), item.qty),
      ),
    );

    this.eventsGateway.broadcastNewTransaction(unitId, savedTx);
    this.eventsGateway.broadcastAnalyticsUpdate(unitId);
    return savedTx;
  }

  // ─── QUERIES ─────────────────────────────────────────────────────────────────
  async findByUnit(unitId: string, page = 1, limit = 50): Promise<TransactionDocument[]> {
    return this.txModel
      .find({ unitId: new Types.ObjectId(unitId) })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('processedBy', 'email')
      .exec();
  }

  async findAll(unitId?: string, page = 1, limit = 50): Promise<TransactionDocument[]> {
    const filter: any = {};
    if (unitId) {
      filter.unitId = new Types.ObjectId(unitId);
    }

    return this.txModel
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('unitId', 'name location')
      .populate('processedBy', 'email')
      .exec();
  }

  async getGlobalSummary() {
    const result = await this.txModel.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalTransactions: {
            $sum: { $cond: [{ $eq: ['$type', TransactionType.SALE] }, 1, 0] },
          },
          totalUnits: { $addToSet: '$unitId' },
        },
      },
      {
        $project: {
          totalRevenue: 1,
          totalTransactions: 1,
          totalUnits: { $size: '$totalUnits' },
        },
      },
    ]);
    return result[0] || { totalRevenue: 0, totalTransactions: 0, totalUnits: 0 };
  }

  async getUnitSummary(unitId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const result = await this.txModel.aggregate([
      {
        $match: {
          unitId: new Types.ObjectId(unitId),
          timestamp: { $gte: start },
        },
      },
      {
        $group: {
          _id: null,
          todayRevenue: { $sum: '$total' },
          todayTransactions: {
            $sum: { $cond: [{ $eq: ['$type', TransactionType.SALE] }, 1, 0] },
          },
        },
      },
    ]);
    return result[0] || { todayRevenue: 0, todayTransactions: 0 };
  }

  async getUnitsPerformance() {
    return this.txModel.aggregate([
      {
        $group: {
          _id: '$unitId',
          totalRevenue: { $sum: '$total' },
          transactionCount: {
            $sum: { $cond: [{ $eq: ['$type', TransactionType.SALE] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: '_id',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      { $unwind: '$unitInfo' },
      {
        $project: {
          unitId: '$_id',
          unitName: '$unitInfo.name',
          revenue: '$totalRevenue',
          count: '$transactionCount',
        },
      },
      { $sort: { revenue: -1 } },
    ]);
  }

  async getAnalytics(unitId: string | null, period: 'week' | 'month' | 'year') {
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        groupFormat = '%Y-%m';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = '%Y-%m-%d';
    }

    const matchQuery: any = {
      timestamp: { $gte: startDate },
    };

    if (unitId) {
      matchQuery.unitId = new Types.ObjectId(unitId);
    }

    const analytics = await this.txModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$timestamp' } },
          revenue: { $sum: '$total' },
          count: {
            $sum: { $cond: [{ $eq: ['$type', TransactionType.SALE] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totalRevenue = analytics.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalTransactions = analytics.reduce((acc, curr) => acc + curr.count, 0);

    return {
      totalRevenue,
      totalTransactions,
      chartData: analytics.map(a => ({
        label: a._id,
        revenue: a.revenue,
        count: a.count,
      })),
    };
  }
}
