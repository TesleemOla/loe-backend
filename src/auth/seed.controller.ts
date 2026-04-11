import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Role } from '../auth/enums/role.enum';

@Controller('seed')
export class SeedController {
  constructor(private usersService: UsersService) {}

  @Get('admin')
  async seedAdmin() {
    const existing = await this.usersService.findByEmail('admin@system.com');
    if (existing) {
      return { message: 'Admin already exists' };
    }
    
    await this.usersService.create({
      email: 'admin@system.com',
      password: 'adminpassword123',
      role: Role.SUPER_ADMIN,
    } as any);
    
    return { message: 'Admin created successfully' };
  }
}
