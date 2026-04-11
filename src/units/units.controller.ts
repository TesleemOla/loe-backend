import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, SetMetadata } from '@nestjs/common';
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';

import { Roles } from '../auth/decorators/roles.decorator';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() createUnitDto: any) {
    return this.unitsService.create(createUnitDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.unitsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateUnitDto: any) {
    return this.unitsService.update(id, updateUnitDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }
}
