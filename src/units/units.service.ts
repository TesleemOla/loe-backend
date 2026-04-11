import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Unit, UnitDocument } from './schemas/unit.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../auth/enums/role.enum';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name) private unitModel: Model<UnitDocument>,
    private usersService: UsersService,
  ) {}

  async create(createUnitDto: any): Promise<UnitDocument> {
    // Extract manager details
    const { managerEmail, managerPassword, ...unitData } = createUnitDto;

    const createdUnit = new this.unitModel(unitData);
    const savedUnit = await createdUnit.save();

    // If manager details provided, create the unit manager
    if (managerEmail && managerPassword) {
      try {
        await this.usersService.create({
          email: managerEmail,
          password: managerPassword,
          role: Role.UNIT_MANAGER,
          unitId: savedUnit._id,
        } as any);
      } catch (err) {
        // If user creation fails, we might want to log it or handle it gracefully,
        // but the unit is already created. For now, log the error.
        console.error('Failed to create manager during unit creation:', err);
      }
    }

    return savedUnit;
  }

  async findAll(): Promise<UnitDocument[]> {
    return this.unitModel.find().exec();
  }

  async findOne(id: string): Promise<UnitDocument | null> {
    return this.unitModel.findById(id).exec();
  }

  async update(id: string, updateUnitDto: any): Promise<UnitDocument | null> {
    return this.unitModel.findByIdAndUpdate(id, updateUnitDto, { new: true }).exec();
  }

  async remove(id: string): Promise<UnitDocument | null> {
    return this.unitModel.findByIdAndDelete(id).exec();
  }
}
