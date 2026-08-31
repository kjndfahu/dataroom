import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 80, { message: 'Name must be between 1 and 80 characters.' })
  name!: string;

  @IsString()
  @Length(8, 128, { message: 'Password must be at least 8 characters.' })
  password!: string;
}
