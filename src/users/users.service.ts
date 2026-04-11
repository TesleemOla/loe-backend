import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(userData: User): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const createdUser = new this.userModel({
      ...userData,
      password: hashedPassword,
    });
    return createdUser.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().populate('unitId', 'name location').select('-password').exec();
  }

  async findManagersByUnit(unitId: string): Promise<UserDocument[]> {
    return this.userModel
      .find({ unitId: new Types.ObjectId(unitId) })
      .select('-password')
      .exec();
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-password')
      .exec();
  }

  async remove(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  async isDatabaseEmpty(): Promise<boolean> {
    const count = await this.userModel.countDocuments().exec();
    return count === 0;
  }
}
