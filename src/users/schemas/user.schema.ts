import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../auth/enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: Role })
  role: Role;

  @Prop({ type: Types.ObjectId, ref: 'Unit', required: false })
  unitId?: Types.ObjectId;

  @Prop()
  lastLogin?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
