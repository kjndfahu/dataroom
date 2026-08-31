import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RenameFolderDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 255, { message: 'Folder name cannot be empty.' })
  name!: string;
}
