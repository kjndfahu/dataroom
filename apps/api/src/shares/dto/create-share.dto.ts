import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ResourceType, ShareRole } from '@prisma/client';

export class CreateShareDto {
  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsUUID()
  resourceId!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  /**
   * The MVP only grants viewers; the column and the check already understand
   * EDITOR, so widening this list is the only change needed later.
   */
  @IsOptional()
  @IsIn([ShareRole.VIEWER])
  role?: ShareRole;
}
