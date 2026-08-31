import { IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class MoveFileDto {
  /** null moves the file to the data room root. */
  @ValidateIf((_object, value) => value !== null)
  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsIn(['fail', 'keepBoth'])
  onConflict?: 'fail' | 'keepBoth';
}
