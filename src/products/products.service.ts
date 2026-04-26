import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import { UnitsService } from '../units/units.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ProductsService {

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
    private readonly unitsService: UnitsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(unitId: string, dto: any): Promise<ProductDocument> {
    const productData = dto;
    
    let targetUnitId: Types.ObjectId;
    let initializeAll = false;

    if (unitId === 'all') {
      const allUnits = await this.unitsService.findAll();
      if (allUnits.length === 0) throw new NotFoundException('No units found to initialize inventory');
      targetUnitId = allUnits[0]._id as Types.ObjectId;
      initializeAll = true;
    } else {
      targetUnitId = new Types.ObjectId(unitId);
    }

    // 1. Create the Global Product Metadata
    const product = new this.productModel({ 
      ...productData, 
      unitId: targetUnitId
    });
    const savedProduct = await product.save();

    // 2. Initialize Inventory mapping
    if (initializeAll) {
      const allUnits = await this.unitsService.findAll();
      const inventoryOps = allUnits.map(unit => ({
        productId: savedProduct._id as Types.ObjectId,
        unitId: unit._id as Types.ObjectId,
      }));
      await this.inventoryModel.insertMany(inventoryOps);
    } else {
      const inventory = new this.inventoryModel({
        productId: savedProduct._id as Types.ObjectId,
        unitId: targetUnitId,
      });
      await inventory.save();
    }

    return savedProduct;
  }

  // Returns all products for a specific unit (Shared Catalog view)
  async findAllByUnit(unitId: string, page = 1, limit = 50, search = ''): Promise<any[]> {
    const skip = (page - 1) * limit;
    const match: any = { isActive: true };
    
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    return this.productModel.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          name: 1,
          sku: 1,
          price: 1,
          isActive: 1,
          unitId: 1,
        }
      }
    ]).exec();
  }

  // Admin view: All products
  async findAll(page = 1, limit = 50): Promise<ProductDocument[]> {
    return this.productModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('unitId', 'name location')
      .exec();
  }

  async findOne(id: string, unitId: string): Promise<any> {
    const products = await this.productModel.aggregate([
      { $match: { _id: new Types.ObjectId(id), isActive: true } },
      {
        $project: {
          name: 1,
          sku: 1,
          price: 1,
          isActive: 1,
          unitId: 1,
        }
      }
    ]).exec();

    if (products.length === 0) throw new NotFoundException('Product not found');
    return products[0];
  }


  async update(id: string, unitId: string | null, dto: any): Promise<ProductDocument> {
    const filter: any = { _id: new Types.ObjectId(id) };
    
    // Updates the global product metadata
    const product = await this.productModel.findOneAndUpdate(
      filter,
      dto,
      { new: true },
    ).exec();

    if (!product) throw new NotFoundException('Product not found');

    return product;
  }


  async remove(id: string, unitId: string | null): Promise<void> {
    const filter: any = { _id: new Types.ObjectId(id) };
    const result = await this.productModel.findOneAndUpdate(
        filter,
        { isActive: false },
    ).exec();
    if (!result) throw new NotFoundException('Product not found');
  }
}
