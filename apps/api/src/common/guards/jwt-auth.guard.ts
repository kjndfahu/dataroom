import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { JwtPayload } from '../../auth/auth.types.js';
import { AUTH_COOKIE } from '../../auth/auth.constants.js';

/**
 * Applied globally: every route requires a valid session unless marked @Public().
 * Failing closed means a new controller is protected by default.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractToken(request);

    if (!token) {
      throw new UnauthorizedException('You need to sign in to continue.');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Your session has expired.');
    }
  }
}

function extractToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string> | undefined;
  const fromCookie = cookies?.[AUTH_COOKIE];
  if (fromCookie) return fromCookie;

  // Bearer tokens keep the API usable from curl and integration tests.
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return undefined;
}
