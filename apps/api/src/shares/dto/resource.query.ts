import { IsEnum, IsUUID } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class ResourceQuery {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsUUID()
  resourceId!: string;
}
