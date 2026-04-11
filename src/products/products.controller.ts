import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Super Admin: view all products across all units
  @Get('all')
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.productsService.findAll();
  }

  // Unit Manager: view their unit's products
  @Get()
  @Roles(Role.UNIT_MANAGER)
  findMine(@Request() req: any) {
    return this.productsService.findAllByUnit(req.user.unitId);
  }

  @Post()
  @Roles(Role.UNIT_MANAGER)
  create(@Request() req: any, @Body() dto: any) {
    return this.productsService.create(req.user.unitId, dto);
  }

  @Patch(':id')
  @Roles(Role.UNIT_MANAGER)
  update(@Param('id') id: string, @Request() req: any, @Body() dto: any) {
    return this.productsService.update(id, req.user.unitId, dto);
  }

  @Delete(':id')
  @Roles(Role.UNIT_MANAGER)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.productsService.remove(id, req.user.unitId);
  }
}
