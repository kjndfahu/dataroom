import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emails are stored and compared lowercased so logins are case-insensitive. */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  create(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: UsersService.normalizeEmail(data.email) },
    });
  }

  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
