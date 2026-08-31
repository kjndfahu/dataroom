import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID, MinDate } from 'class-validator';
import { ResourceType } from '@prisma/client';

export class CreatePublicLinkDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsUUID()
  resourceId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(), { message: 'The expiry date must be in the future.' })
  expiresAt?: Date;
}
