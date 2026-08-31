import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicLink, ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SharesService,
  resourceWhere,
  type ResourceRef,
} from '../shares/shares.service.js';

export interface PublicLinkSummary {
  id: string;
  token: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  active: boolean;
  createdAt: Date;
  expiresAt: Date | null;
}

@Injectable()
export class PublicLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shares: SharesService,
  ) {}

  /**
   * One active link per resource: asking again returns the existing token so a
   * second click cannot silently invalidate a link that is already circulating.
   */
  async create(
    userId: string,
    input: ResourceRef & { expiresAt?: Date | null },
  ): Promise<PublicLinkSummary> {
    const resource = await this.shares.requireOwnedResource(userId, input);
    const where = resourceWhere(input);

    const existing = await this.prisma.publicLink.findFirst({
      where: { ...where, active: true },
    });

    const link =
      existing ??
      (await this.prisma.publicLink.create({
        data: {
          ...where,
          token: generateToken(),
          createdById: userId,
          expiresAt: input.expiresAt ?? null,
        },
      }));

    return toSummary(link, input.resourceId, resource.name);
  }

  async listForResource(
    userId: string,
    ref: ResourceRef,
  ): Promise<PublicLinkSummary[]> {
    const resource = await this.shares.requireOwnedResource(userId, ref);

    const links = await this.prisma.publicLink.findMany({
      where: { ...resourceWhere(ref), active: true },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => toSummary(link, ref.resourceId, resource.name));
  }

  /** Deactivating is enough: every public lookup requires active = true. */
  async revoke(userId: string, linkId: string): Promise<void> {
    const link = await this.prisma.publicLink.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        active: true,
        resourceType: true,
        dataRoomId: true,
        folderId: true,
        fileId: true,
      },
    });

    if (!link || !link.active) {
      throw new NotFoundException('That link no longer exists.');
    }

    const resourceId = link.dataRoomId ?? link.folderId ?? link.fileId;
    if (!resourceId) throw new NotFoundException('That link no longer exists.');

    await this.shares.requireOwnedResource(userId, {
      resourceType: link.resourceType,
      resourceId,
    });

    await this.prisma.publicLink.update({
      where: { id: link.id },
      data: { active: false },
    });
  }
}

/** 32 characters of cryptographic randomness — never a database id. */
function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

function toSummary(
  link: PublicLink,
  resourceId: string,
  resourceName: string,
): PublicLinkSummary {
  return {
    id: link.id,
    token: link.token,
    resourceType: link.resourceType,
    resourceId,
    resourceName,
    active: link.active,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
  };
}
