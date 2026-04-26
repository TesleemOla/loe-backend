import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true, unique: true })
  clientId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  phone?: string;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: false })
  unitId?: Types.ObjectId;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
