import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class ConfirmUploadDto {
  @IsUUID()
  dataRoomId!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  /** Issued by the API; the shape is enforced again server-side. */
  @IsString()
  @Matches(/^dataroom\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/, {
    message: 'Unknown upload.',
  })
  storageKey!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 255, { message: 'File name cannot be empty.' })
  fileName!: string;

  @IsOptional()
  @IsIn(['fail', 'keepBoth'])
  onConflict?: 'fail' | 'keepBoth';
}
