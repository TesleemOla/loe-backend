import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── Super Admin: Global analytics ─────────────────────────────────────────

  @Get('global/summary')
  @Roles(Role.SUPER_ADMIN)
  getGlobalSummary(@Query('period') period: 'day' | 'week' | 'month' = 'month') {
    return this.analyticsService.getPeriodSummary(null, period);
  }

  @Get('global/trend')
  @Roles(Role.SUPER_ADMIN)
  getGlobalTrend() {
    return this.analyticsService.getRevenueTrend(null);
  }

  @Get('global/units')
  @Roles(Role.SUPER_ADMIN)
  getUnitComparison() {
    return this.analyticsService.getUnitComparison();
  }

  @Get('global/top-products')
  @Roles(Role.SUPER_ADMIN)
  getGlobalTopProducts() {
    return this.analyticsService.getTopProducts(null);
  }

  @Get('global/monthly')
  @Roles(Role.SUPER_ADMIN)
  getGlobalMonthly() {
    return this.analyticsService.getMonthlyReport(null);
  }

  // ── Unit Manager: Local analytics ─────────────────────────────────────────

  @Get('local/summary')
  @Roles(Role.UNIT_MANAGER)
  getLocalSummary(@Request() req: any, @Query('period') period: 'day' | 'week' | 'month' = 'month') {
    return this.analyticsService.getPeriodSummary(req.user.unitId, period);
  }

  @Get('local/trend')
  @Roles(Role.UNIT_MANAGER)
  getLocalTrend(@Request() req: any) {
    return this.analyticsService.getRevenueTrend(req.user.unitId);
  }

  @Get('local/top-products')
  @Roles(Role.UNIT_MANAGER)
  getLocalTopProducts(@Request() req: any) {
    return this.analyticsService.getTopProducts(req.user.unitId);
  }

  @Get('local/monthly')
  @Roles(Role.UNIT_MANAGER)
  getLocalMonthly(@Request() req: any) {
    return this.analyticsService.getMonthlyReport(req.user.unitId);
  }
}
