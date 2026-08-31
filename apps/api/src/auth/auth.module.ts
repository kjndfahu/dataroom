import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { Env } from '../config/env.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('AUTH_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('AUTH_TOKEN_TTL', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Authentication is on by default; @Public() opts individual routes out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
