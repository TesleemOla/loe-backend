import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  SALE = 'SALE',
  VOID = 'VOID',
  REFUND = 'REFUND',
}

export class TransactionItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop({ required: true, type: Number })
  qty: number;

  @Prop({ required: true, type: Number })
  priceAtTime: number;
}

export class PaymentLogEntry {
  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  recordedBy: Types.ObjectId;

  @Prop({ default: Date.now })
  timestamp: Date;
}

@Schema({
  timestamps: true,
  strict: true,
})
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ type: [{ productId: Types.ObjectId, productName: String, qty: Number, priceAtTime: Number }], required: true })
  items: TransactionItem[];

  @Prop({ required: true, type: Number })
  total: number;

  @Prop({ type: Types.ObjectId, ref: 'Transaction', required: false })
  referenceId?: Types.ObjectId; // Links VOID/REFUND back to original SALE

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  processedBy: Types.ObjectId;

  @Prop({ type: String, default: 'Guest' })
  customerName: string;

  @Prop({ required: true, type: Number, default: 0 })
  amountPaid: number;

  @Prop({ type: [{ amount: Number, recordedBy: { type: Types.ObjectId, ref: 'User' }, timestamp: { type: Date, default: Date.now } }], default: [] })
  paymentLog: PaymentLogEntry[];

  @Prop({ default: Date.now })
  timestamp: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Make documents immutable after creation — no updates allowed via Mongoose
TransactionSchema.set('strict', true);
