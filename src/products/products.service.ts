import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(unitId: string, dto: any): Promise<ProductDocument> {
    const product = new this.productModel({ ...dto, unitId: new Types.ObjectId(unitId) });
    return product.save();
  }

  async findAllByUnit(unitId: string): Promise<ProductDocument[]> {
    return this.productModel.find({ unitId: new Types.ObjectId(unitId), isActive: true }).exec();
  }

  async findAll(): Promise<ProductDocument[]> {
    return this.productModel.find({ isActive: true }).populate('unitId', 'name location').exec();
  }

  async findOne(id: string, unitId: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({
      _id: new Types.ObjectId(id),
      unitId: new Types.ObjectId(unitId),
    }).exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, unitId: string, dto: any): Promise<ProductDocument> {
    const product = await this.productModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), unitId: new Types.ObjectId(unitId) },
      dto,
      { new: true },
    ).exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async remove(id: string, unitId: string): Promise<void> {
    // Soft delete
    const result = await this.productModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), unitId: new Types.ObjectId(unitId) },
      { isActive: false },
    ).exec();
    if (!result) throw new NotFoundException('Product not found');
  }
}
