import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../auth/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  create(@Body() createClientDto: any) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  findAll(@Query('unitId') unitId?: string) {
    return this.clientsService.findAll(unitId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Get(':id/statement')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  getStatement(@Param('id') id: string) {
    return this.clientsService.getClientStatement(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.UNIT_MANAGER)
  update(@Param('id') id: string, @Body() updateClientDto: any) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
