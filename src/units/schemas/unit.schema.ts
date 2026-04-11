import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UnitDocument = Unit & Document;

@Schema({ timestamps: true })
export class Unit {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  location: string;

  @Prop({
    type: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'UTC' },
    },
    _id: false,
  })
  settings: {
    currency: string;
    timezone: string;
  };
}

export const UnitSchema = SchemaFactory.createForClass(Unit);
