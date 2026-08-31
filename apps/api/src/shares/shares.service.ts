import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ResourceType, ShareRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { UsersService } from '../users/users.service.js';

export interface ShareSummary {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  role: ShareRole;
  recipient: { id: string; email: string; name: string };
  createdAt: Date;
}

export interface ReceivedShare {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  role: ShareRole;
  dataRoomId: string;
  dataRoomName: string;
  sharedBy: { id: string; name: string; email: string };
  createdAt: Date;
}

export interface ResourceRef {
  resourceType: ResourceType;
  resourceId: string;
}

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly users: UsersService,
  ) {}

  /**
   * Only the data room's owner may hand out access. Sharing rights are
   * deliberately not inherited by recipients, so a viewer cannot re-share.
   */
  async create(
    userId: string,
    input: ResourceRef & { email: string; role?: ShareRole },
  ): Promise<ShareSummary> {
    const resource = await this.requireOwnedResource(userId, input);

    const recipient = await this.users.findByEmail(input.email);
    if (!recipient) {
      throw new NotFoundException(
        'No account with that email. Ask them to sign up first.',
      );
    }

    if (recipient.id === userId) {
      throw new BadRequestException('You already own this item.');
    }

    const role: ShareRole = input.role ?? 'VIEWER';
    const where = resourceWhere(input);

    const existing = await this.prisma.share.findFirst({
      where: { ...where, recipientUserId: recipient.id, revokedAt: null },
    });

    // Re-sharing the same resource updates the role instead of piling up rows.
    const share = existing
      ? await this.prisma.share.update({
          where: { id: existing.id },
          data: { role },
        })
      : await this.prisma.share.create({
          data: {
            ...where,
            resourceType: input.resourceType,
            ownerId: userId,
            recipientUserId: recipient.id,
            role,
          },
        });

    return {
      id: share.id,
      resourceType: share.resourceType,
      resourceId: input.resourceId,
      resourceName: resource.name,
      role: share.role,
      recipient: {
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
      },
      createdAt: share.createdAt,
    };
  }

  /** Active shares on one resource, for the owner's share dialog. */
  async listForResource(
    userId: string,
    ref: ResourceRef,
  ): Promise<ShareSummary[]> {
    const resource = await this.requireOwnedResource(userId, ref);

    const shares = await this.prisma.share.findMany({
      where: { ...resourceWhere(ref), revokedAt: null },
      include: {
        recipient: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return shares.map((share) => ({
      id: share.id,
      resourceType: share.resourceType,
      resourceId: ref.resourceId,
      resourceName: resource.name,
      role: share.role,
      recipient: share.recipient,
      createdAt: share.createdAt,
    }));
  }

  /** Everything currently shared with the user, across resource types. */
  async listReceived(userId: string): Promise<ReceivedShare[]> {
    const shares = await this.prisma.share.findMany({
      where: { recipientUserId: userId, revokedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        dataRoom: { select: { id: true, name: true } },
        folder: {
          select: { id: true, name: true, dataRoom: { select: { id: true, name: true } } },
        },
        file: {
          select: { id: true, name: true, dataRoom: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return shares.flatMap((share) => {
      const resource =
        share.resourceType === 'DATA_ROOM'
          ? share.dataRoom && {
              id: share.dataRoom.id,
              name: share.dataRoom.name,
              room: share.dataRoom,
            }
          : share.resourceType === 'FOLDER'
            ? share.folder && {
                id: share.folder.id,
                name: share.folder.name,
                room: share.folder.dataRoom,
              }
            : share.file && {
                id: share.file.id,
                name: share.file.name,
                room: share.file.dataRoom,
              };

      if (!resource) return [];

      return [
        {
          id: share.id,
          resourceType: share.resourceType,
          resourceId: resource.id,
          resourceName: resource.name,
          role: share.role,
          dataRoomId: resource.room.id,
          dataRoomName: resource.room.name,
          sharedBy: share.owner,
          createdAt: share.createdAt,
        },
      ];
    });
  }

  /**
   * Revoking is a timestamp, not a delete: access stops immediately because
   * every permission check filters on revokedAt, and the history survives.
   */
  async revoke(userId: string, shareId: string): Promise<void> {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      select: {
        id: true,
        ownerId: true,
        revokedAt: true,
        resourceType: true,
        dataRoomId: true,
        folderId: true,
        fileId: true,
      },
    });

    if (!share || share.revokedAt) {
      throw new NotFoundException('That share no longer exists.');
    }

    const resourceId =
      share.dataRoomId ?? share.folderId ?? share.fileId ?? undefined;
    if (!resourceId) throw new NotFoundException('That share no longer exists.');

    await this.requireOwnedResource(userId, {
      resourceType: share.resourceType,
      resourceId,
    });

    await this.prisma.share.update({
      where: { id: share.id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Resolves the resource and proves the caller owns the data room it lives in.
   * Anything else answers 404, so probing ids reveals nothing.
   */
  async requireOwnedResource(
    userId: string,
    ref: ResourceRef,
  ): Promise<{ name: string; dataRoomId: string }> {
    switch (ref.resourceType) {
      case 'DATA_ROOM': {
        const grant = await this.authorization.requireDataRoomRead(
          userId,
          ref.resourceId,
        );
        this.assertOwner(grant.isOwner);

        const dataRoom = await this.prisma.dataRoom.findUniqueOrThrow({
          where: { id: ref.resourceId },
          select: { name: true, id: true },
        });
        return { name: dataRoom.name, dataRoomId: dataRoom.id };
      }

      case 'FOLDER': {
        const grant = await this.authorization.requireFolderRead(
          userId,
          ref.resourceId,
        );
        this.assertOwner(grant.isOwner);

        const folder = await this.prisma.folder.findUniqueOrThrow({
          where: { id: ref.resourceId },
          select: { name: true, dataRoomId: true },
        });
        return folder;
      }

      case 'FILE': {
        const grant = await this.authorization.requireFileRead(
          userId,
          ref.resourceId,
        );
        this.assertOwner(grant.isOwner);

        const file = await this.prisma.file.findUniqueOrThrow({
          where: { id: ref.resourceId },
          select: { name: true, dataRoomId: true },
        });
        return file;
      }
    }
  }

  private assertOwner(isOwner: boolean): void {
    if (!isOwner) {
      throw new ForbiddenException('Only the owner can share this item.');
    }
  }
}

/** Maps a resource reference onto the polymorphic share columns. */
export function resourceWhere(ref: ResourceRef): {
  dataRoomId: string | null;
  folderId: string | null;
  fileId: string | null;
  resourceType: ResourceType;
} {
  return {
    resourceType: ref.resourceType,
    dataRoomId: ref.resourceType === 'DATA_ROOM' ? ref.resourceId : null,
    folderId: ref.resourceType === 'FOLDER' ? ref.resourceId : null,
    fileId: ref.resourceType === 'FILE' ? ref.resourceId : null,
  };
}
