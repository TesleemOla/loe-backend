import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
  ) {}

  async create(clientData: Partial<Client>): Promise<ClientDocument> {
    const count = await this.clientModel.countDocuments().exec();
    const clientId = `CLI-${(count + 1).toString().padStart(4, '0')}`;
    
    const client = new this.clientModel({
      ...clientData,
      clientId
    });
    return client.save();
  }

  async findAll(unitId?: string): Promise<any[]> {
    const filter: any = {};
    if (unitId && Types.ObjectId.isValid(unitId)) {
      filter.unitId = new Types.ObjectId(unitId);
    }

    const clients = await this.clientModel.find(filter).exec();
    
    // Enrich with balance information
    return Promise.all(clients.map(async (client) => {
      const summary = await this.getClientSummary(client._id.toString());
      return {
        ...client.toObject(),
        ...summary
      };
    }));
  }

  async findOne(id: string): Promise<ClientDocument> {
    const client = await this.clientModel.findById(id).exec();
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, updateData: Partial<Client>): Promise<ClientDocument> {
    const client = await this.clientModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async remove(id: string): Promise<void> {
    await this.clientModel.findByIdAndDelete(id).exec();
  }

  async getClientSummary(clientId: string) {
    if (!Types.ObjectId.isValid(clientId)) {
      return { totalPurchases: 0, totalPaid: 0, balance: 0 };
    }
    const result = await this.txModel.aggregate([
      { $match: { clientId: new Types.ObjectId(clientId), type: { $in: [TransactionType.SALE, TransactionType.PAYMENT] } } },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: '$total' },
          totalPaid: { $sum: '$amountPaid' },
        }
      }
    ]);

    const summary = result[0] || { totalPurchases: 0, totalPaid: 0 };
    return {
      totalPurchases: summary.totalPurchases,
      totalPaid: summary.totalPaid,
      balance: summary.totalPurchases - summary.totalPaid
    };
  }

  async getClientStatement(clientId: string) {
    if (!Types.ObjectId.isValid(clientId)) {
      throw new NotFoundException('Invalid Client ID');
    }
    const client = await this.findOne(clientId);
    const transactions = await this.txModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .sort({ timestamp: 1 })
      .exec();

    let runningBalance = 0;
    const statement = transactions.map(tx => {
      if (tx.type === TransactionType.SALE) {
        runningBalance += tx.total;
        // Payments are credits against the balance
        runningBalance -= tx.amountPaid;
      } else if (tx.type === TransactionType.PAYMENT) {
        runningBalance -= tx.amountPaid;
      } else if (tx.type === TransactionType.VOID || tx.type === TransactionType.REFUND) {
        runningBalance += tx.total; // total is negative for void/refund
      }

      return {
        _id: tx._id,
        date: tx.timestamp,
        type: tx.type,
        total: tx.total,
        paid: tx.amountPaid || 0,
        balance: tx.total - (tx.amountPaid || 0),
        items: tx.items.map(item => `${item.qty}x ${item.productName}`).join(', ')
      };
    });

    const summary = await this.getClientSummary(clientId);

    return {
      client,
      statement,
      summary
    };
  }
}
