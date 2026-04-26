import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema({ timestamps: true })
export class Inventory {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

// Ensures a unique inventory record for each product per unit
InventorySchema.index({ productId: 1, unitId: 1 }, { unique: true });
