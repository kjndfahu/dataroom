import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type { CookieOptions, Response } from 'express';
import { UsersService, type PublicUser } from '../users/users.service.js';
import { DataRoomsService } from '../datarooms/datarooms.service.js';
import type { Env } from '../config/env.js';
import type { JwtPayload } from './auth.types.js';
import { AUTH_COOKIE } from './auth.constants.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly dataRooms: DataRoomsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await argon2.hash(dto.password),
    });

    // Every account starts with one data room so the app is never empty.
    await this.dataRooms.create(user.id, 'My Data Room');

    return UsersService.toPublicUser(user);
  }

  async validateCredentials(dto: LoginDto): Promise<PublicUser> {
    const user = await this.users.findByEmail(dto.email);

    // Same message either way: don't reveal which emails are registered.
    const invalid = new UnauthorizedException(
      'Incorrect email or password.',
    );
    if (!user) {
      // Spend comparable time so a missing account is not detectably faster.
      await argon2.hash(dto.password);
      throw invalid;
    }

    const matches = await argon2.verify(user.passwordHash, dto.password);
    if (!matches) throw invalid;

    return UsersService.toPublicUser(user);
  }

  async issueSession(response: Response, user: PublicUser): Promise<void> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const token = await this.jwt.signAsync(payload);

    response.cookie(AUTH_COOKIE, token, this.cookieOptions());
  }

  clearSession(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    response.clearCookie(AUTH_COOKIE, options);
  }

  private cookieOptions(): CookieOptions {
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      // In production the web app and API sit on different domains,
      // so the cookie has to be allowed cross-site.
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: ttlToMilliseconds(
        this.config.get('AUTH_TOKEN_TTL', { infer: true }),
      ),
    };
  }
}

/** Converts a jsonwebtoken-style duration ("7d", "12h", "3600") to milliseconds. */
function ttlToMilliseconds(ttl: string): number {
  const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * (multipliers[unit] ?? 1000);
}
