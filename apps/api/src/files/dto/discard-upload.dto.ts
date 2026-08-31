import { IsString, Matches } from 'class-validator';

export class DiscardUploadDto {
  @IsString()
  @Matches(/^dataroom\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/, {
    message: 'Unknown upload.',
  })
  storageKey!: string;
}
