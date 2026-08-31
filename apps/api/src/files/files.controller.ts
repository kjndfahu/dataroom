import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { FilesService, type FileDetail } from './files.service.js';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import { DiscardUploadDto } from './dto/discard-upload.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.files.createUploadUrl(user.id, dto);
  }

  @Post()
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmUploadDto,
  ): Promise<FileDetail> {
    return this.files.confirmUpload(user.id, dto);
  }

  /** Cancelled upload: drop the object that was already stored. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('discard')
  discard(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DiscardUploadDto,
  ): Promise<void> {
    return this.files.discardUpload(user.id, dto.storageKey);
  }
}
