import { Controller, Post, Body, UnauthorizedException, Get, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role } from './enums/role.enum';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Get('setup-status')
  async getSetupStatus() {
    const setupRequired = await this.authService.isSetupRequired();
    return { setupRequired };
  }

  @Post('setup')
  async setup(@Body() body: any) {
    const setupRequired = await this.authService.isSetupRequired();
    if (!setupRequired) {
      throw new BadRequestException('System is already setup');
    }
    
    // Create the inaugural user as a Super Admin
    const user = await this.usersService.create({
      ...body,
      role: Role.SUPER_ADMIN,
    });
    
    return { 
      message: 'Inaugural user created successfully',
      user: { id: user._id, email: user.email, role: user.role }
    };
  }

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: any) {
    // Basic registration for demonstration. You'd normally want guards here.
    return this.usersService.create(body);
  }
}
