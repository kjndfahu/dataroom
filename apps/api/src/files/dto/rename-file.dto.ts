import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RenameFileDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 255, { message: 'File name cannot be empty.' })
  name!: string;

  @IsOptional()
  @IsIn(['fail', 'keepBoth'])
  onConflict?: 'fail' | 'keepBoth';
}
