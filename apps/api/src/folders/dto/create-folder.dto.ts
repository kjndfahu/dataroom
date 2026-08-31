import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateFolderDto {
  @IsUUID()
  dataRoomId!: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 255, { message: 'Folder name cannot be empty.' })
  name!: string;
}
