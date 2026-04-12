import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import { UnitsService } from '../units/units.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ProductsService {
  private readonly LOW_STOCK_THRESHOLD = 10;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
    private readonly unitsService: UnitsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(unitId: string, dto: any): Promise<ProductDocument> {
    const { stock, ...productData } = dto;
    
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

    // 2. Initialize Inventory
    if (initializeAll) {
      const allUnits = await this.unitsService.findAll();
      const inventoryOps = allUnits.map(unit => ({
        productId: savedProduct._id as Types.ObjectId,
        unitId: unit._id as Types.ObjectId,
        stock: stock || 0,
      }));
      await this.inventoryModel.insertMany(inventoryOps);
    } else {
      const inventory = new this.inventoryModel({
        productId: savedProduct._id as Types.ObjectId,
        unitId: targetUnitId,
        stock: stock || 0,
      });
      await inventory.save();
    }

    return savedProduct;
  }

  // Returns all products with stock for a specific unit (Shared Catalog view)
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
        $lookup: {
          from: 'inventories', 
          let: { prodId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$productId', '$$prodId'] },
                    { $eq: ['$unitId', new Types.ObjectId(unitId)] }
                  ]
                }
              }
            }
          ],
          as: 'inventory'
        }
      },
      {
        $project: {
          name: 1,
          sku: 1,
          price: 1,
          isActive: 1,
          unitId: 1,
          stock: { $ifNull: [{ $arrayElemAt: ['$inventory.stock', 0] }, 0] }
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
        $lookup: {
          from: 'inventories',
          let: { prodId: '$_id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $and: [
                    { $eq: ['$productId', '$$prodId'] },
                    { $eq: ['$unitId', new Types.ObjectId(unitId)] }
                  ]
                }
              }
            }
          ],
          as: 'inventory'
        }
      },
      {
        $project: {
          name: 1,
          sku: 1,
          price: 1,
          isActive: 1,
          unitId: 1,
          stock: { $ifNull: [{ $arrayElemAt: ['$inventory.stock', 0] }, 0] }
        }
      }
    ]).exec();

    if (products.length === 0) throw new NotFoundException('Product not found');
    return products[0];
  }

  async updateStock(unitId: string, productId: string, delta: number): Promise<void> {
    const updated = await this.inventoryModel.findOneAndUpdate(
      { 
        productId: new Types.ObjectId(productId), 
        unitId: new Types.ObjectId(unitId) 
      },
      { $inc: { stock: delta } },
      { upsert: true, new: true } 
    ).exec();

    if (updated.stock <= this.LOW_STOCK_THRESHOLD) {
      const product = await this.productModel.findById(productId);
      if (product) {
        this.eventsGateway.broadcastLowStockAlert(unitId, {
          ...product.toObject(),
          stock: updated.stock
        });
      }
    }
  }

  async update(id: string, unitId: string | null, dto: any): Promise<ProductDocument> {
    const { stock, ...productData } = dto;
    const filter: any = { _id: new Types.ObjectId(id) };
    
    // Updates the global product metadata
    const product = await this.productModel.findOneAndUpdate(
      filter,
      productData,
      { new: true },
    ).exec();

    if (!product) throw new NotFoundException('Product not found');

    // If stock was provided in the edit, update it specifically for that unit
    if (stock !== undefined && unitId) {
      await this.updateStock(unitId, id, 0); // Ensure record exists
      await this.inventoryModel.findOneAndUpdate(
        { productId: product._id, unitId: new Types.ObjectId(unitId) },
        { stock: parseInt(stock) }
      ).exec();
    }

    return product;
  }

  async bulkUpdateInventory(unitId: string, updates: { productId: string; stock: number }[]): Promise<void> {
    const ops = updates.map((update) => ({
      updateOne: {
        filter: { 
          productId: new Types.ObjectId(update.productId), 
          unitId: new Types.ObjectId(unitId) 
        },
        update: { stock: update.stock },
        upsert: true,
      },
    }));

    await this.inventoryModel.bulkWrite(ops);

    // After bulk update, check for low stock on all updated products
    // This is a bit heavy, but ensures consistency for notifications
    for (const update of updates) {
      const current = await this.inventoryModel.findOne({
        productId: new Types.ObjectId(update.productId),
        unitId: new Types.ObjectId(unitId)
      });
      if (current && current.stock <= this.LOW_STOCK_THRESHOLD) {
        const product = await this.productModel.findById(update.productId);
        if (product) {
          this.eventsGateway.broadcastLowStockAlert(unitId, {
            ...product.toObject(),
            stock: current.stock
          });
        }
      }
    }
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
