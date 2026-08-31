import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateUploadUrlDto {
  @IsUUID()
  dataRoomId!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 255, { message: 'File name cannot be empty.' })
  fileName!: string;

  @IsInt()
  @Min(1, { message: 'The file is empty.' })
  size!: number;

  @IsString()
  @Length(1, 128)
  mimeType!: string;
}
