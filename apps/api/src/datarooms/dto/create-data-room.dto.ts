import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateDataRoomDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters.' })
  name!: string;
}
