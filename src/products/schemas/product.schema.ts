import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true })
  unitId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  sku: string;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true, type: Number, default: 0 })
  stock: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Compound index: same SKU can't appear twice within a unit
ProductSchema.index({ unitId: 1, sku: 1 }, { unique: true });
