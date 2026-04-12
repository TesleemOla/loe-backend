import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('analytics')
  getAnalytics(
    @Request() req: any, 
    @Query('period') period: 'week' | 'month' | 'year',
    @Query('unitId') unitIdFilter?: string
  ) {
    const unitId = req.user.role === Role.UNIT_MANAGER ? req.user.unitId : (unitIdFilter || null);
    return this.transactionsService.getAnalytics(unitId, period || 'month');
  }

  // ── Super Admin ────────────────────────────────────────────────────────────
  @Get('all')
  @Roles(Role.SUPER_ADMIN)
  findAll(@Query('unitId') unitId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.transactionsService.findAll(
      unitId,
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 50
    );
  }

  @Get('summary/global')
  @Roles(Role.SUPER_ADMIN)
  getGlobalSummary() {
    return this.transactionsService.getGlobalSummary();
  }

  @Get('performance/units')
  @Roles(Role.SUPER_ADMIN)
  getUnitsPerformance() {
    return this.transactionsService.getUnitsPerformance();
  }

  // ── Unit Manager ───────────────────────────────────────────────────────────
  @Get()
  @Roles(Role.UNIT_MANAGER)
  findMine(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.transactionsService.findByUnit(
      req.user.unitId,
      page ? parseInt(page) : 1, 
      limit ? parseInt(limit) : 50
    );
  }

  @Get('summary/local')
  @Roles(Role.UNIT_MANAGER)
  getLocalSummary(@Request() req: any) {
    return this.transactionsService.getUnitSummary(req.user.unitId);
  }

  @Post('sale')
  @Roles(Role.UNIT_MANAGER)
  createSale(
    @Request() req: any,
    @Body() body: { items: { productId: string; qty: number; overridePrice?: number }[]; customerName?: string; amountPaid?: number },
  ) {
    return this.transactionsService.createSale(
      req.user.unitId,
      req.user.userId,
      body.items,
      body.customerName,
      body.amountPaid,
    );
  }

  @Post(':id/void')
  @Roles(Role.UNIT_MANAGER)
  voidSale(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.voidSale(id, req.user.unitId, req.user.userId);
  }

  @Post(':id/refund')
  @Roles(Role.UNIT_MANAGER)
  refundSale(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { items: { productId: string; qty: number }[] },
  ) {
    return this.transactionsService.refundSale(id, req.user.unitId, req.user.userId, body.items);
  }
}
