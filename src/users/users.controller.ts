import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Super Admin: Manage all users ─────────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ── Any authenticated user: own profile ──────────────────────────────────
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
