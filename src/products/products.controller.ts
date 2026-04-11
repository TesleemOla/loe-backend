import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, ForbiddenException, Query,
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
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.productsService.findAll(
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 50
    );
  }

  // Unit Manager: view their unit's products
  @Get()
  @Roles(Role.UNIT_MANAGER)
  findMine(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.productsService.findAllByUnit(
      req.user.unitId, 
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 50,
      search || ''
    );
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  create(@Request() req: any, @Body() dto: any) {
    const unitId = req.user.role === Role.SUPER_ADMIN ? dto.unitId : req.user.unitId;
    if (!unitId) throw new ForbiddenException('unitId is required for this operation');
    return this.productsService.create(unitId, dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  update(@Param('id') id: string, @Request() req: any, @Body() dto: any) {
    // If Super Admin, we allow updating any product regardless of current unit context
    // If Manager, we enforce unit ownership
    if (req.user.role === Role.SUPER_ADMIN) {
        // We still need the actual unitId of the product to use the existing service method
        // Or we can modify the service to have a bypass
        return this.productsService.update(id, dto.unitId, dto); 
        // Note: This assumes the client sends the unitId. 
        // Let's improve the service to handle optional unitId for updates.
    }
    return this.productsService.update(id, req.user.unitId, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  async remove(@Param('id') id: string, @Request() req: any, @Query('unitId') unitId?: string) {
    const targetUnitId = req.user.role === Role.SUPER_ADMIN ? unitId : req.user.unitId;
    if (!targetUnitId) throw new ForbiddenException('unitId is required for this operation');
    await this.productsService.remove(id, targetUnitId);
    return { success: true, message: 'Product deactivated' };
  }

  @Patch('inventory/bulk')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  bulkUpdateStock(@Request() req: any, @Body() body: { updates: { productId: string; stock: number }[] }) {
    const unitId = req.user.unitId;
    if (!unitId) throw new ForbiddenException('unitId is required for this operation');
    return this.productsService.bulkUpdateInventory(unitId, body.updates);
  }
}
