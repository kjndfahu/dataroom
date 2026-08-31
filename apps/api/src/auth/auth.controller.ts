import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './auth.types.js';
import { UsersService, type PublicUser } from '../users/users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const user = await this.auth.register(dto);
    await this.auth.issueSession(response, user);
    return user;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const user = await this.auth.validateCredentials(dto);
    await this.auth.issueSession(response, user);
    return user;
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): void {
    this.auth.clearSession(response);
  }

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.users.findById(current.id);
    // The token can outlive the account it points at.
    if (!user) throw new NotFoundException('This account no longer exists.');
    return user;
  }
}
