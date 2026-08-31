import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListItemsQuery {
  @IsOptional()
  @IsUUID()
  folderCursor?: string;

  @IsOptional()
  @IsUUID()
  fileCursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
