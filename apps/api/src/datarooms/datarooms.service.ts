import { Injectable } from '@nestjs/common';
import type { ShareRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { canEdit } from '../authorization/access.types.js';

export interface DataRoomSummary {
  id: string;
  name: string;
  role: ShareRole;
  isOwner: boolean;
  canEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataRoomStats {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

export interface DataRoomDetail extends DataRoomSummary {
  owner: { id: string; name: string; email: string };
  stats: DataRoomStats;
}

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async create(userId: string, name: string): Promise<DataRoomSummary> {
    const dataRoom = await this.prisma.dataRoom.create({
      data: { name, ownerId: userId },
    });

    return {
      id: dataRoom.id,
      name: dataRoom.name,
      role: 'OWNER',
      isOwner: true,
      canEdit: true,
      createdAt: dataRoom.createdAt,
      updatedAt: dataRoom.updatedAt,
    };
  }

  /** Rooms the user owns, plus rooms shared with them at the room level. */
  async listForUser(userId: string): Promise<{
    owned: DataRoomSummary[];
    shared: DataRoomSummary[];
  }> {
    const [owned, shares] = await Promise.all([
      this.prisma.dataRoom.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.share.findMany({
        where: {
          recipientUserId: userId,
          revokedAt: null,
          resourceType: 'DATA_ROOM',
        },
        select: { role: true, dataRoom: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      owned: owned.map((dataRoom) => ({
        id: dataRoom.id,
        name: dataRoom.name,
        role: 'OWNER' as const,
        isOwner: true,
        canEdit: true,
        createdAt: dataRoom.createdAt,
        updatedAt: dataRoom.updatedAt,
      })),
      shared: shares.flatMap((share) => {
        if (!share.dataRoom) return [];
        return [
          {
            id: share.dataRoom.id,
            name: share.dataRoom.name,
            role: share.role,
            isOwner: false,
            canEdit: canEdit({
              role: share.role,
              isOwner: false,
              dataRoomId: share.dataRoom.id,
            }),
            createdAt: share.dataRoom.createdAt,
            updatedAt: share.dataRoom.updatedAt,
          },
        ];
      }),
    };
  }

  async findOne(userId: string, dataRoomId: string): Promise<DataRoomDetail> {
    const grant = await this.authorization.requireDataRoomRead(
      userId,
      dataRoomId,
    );

    const [dataRoom, stats] = await Promise.all([
      this.prisma.dataRoom.findUniqueOrThrow({
        where: { id: dataRoomId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      }),
      this.statsFor(dataRoomId),
    ]);

    return {
      id: dataRoom.id,
      name: dataRoom.name,
      role: grant.role,
      isOwner: grant.isOwner,
      canEdit: canEdit(grant),
      createdAt: dataRoom.createdAt,
      updatedAt: dataRoom.updatedAt,
      owner: dataRoom.owner,
      stats,
    };
  }

  /**
   * Room-wide totals. Every folder and file carries its dataRoomId, so this is
   * two indexed aggregates rather than a walk over the folder tree.
   */
  async statsFor(dataRoomId: string): Promise<DataRoomStats> {
    const [folderCount, fileAggregate] = await Promise.all([
      this.prisma.folder.count({ where: { dataRoomId } }),
      this.prisma.file.aggregate({
        where: { dataRoomId },
        _count: { _all: true },
        _sum: { size: true },
      }),
    ]);

    return {
      folderCount,
      fileCount: fileAggregate._count._all,
      totalSize: Number(fileAggregate._sum.size ?? 0n),
    };
  }
}
