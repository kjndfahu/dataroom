import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { FilesService, type FileDetail } from './files.service.js';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import { DiscardUploadDto } from './dto/discard-upload.dto.js';
import { RenameFileDto } from './dto/rename-file.dto.js';
import { MoveFileDto } from './dto/move-file.dto.js';
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

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileDetail & { canEdit: boolean }> {
    return this.files.findOne(user.id, id);
  }

  @Get(':id/preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string; name: string; size: number; expiresIn: number }> {
    return this.files.createPreviewUrl(user.id, id);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFileDto,
  ): Promise<FileDetail> {
    return this.files.rename(user.id, id, dto.name, dto.onConflict);
  }

  @Post(':id/move')
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFileDto,
  ): Promise<FileDetail> {
    return this.files.move(user.id, id, dto.folderId ?? null, dto.onConflict);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; orphanedObjects: number }> {
    return this.files.remove(user.id, id);
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
