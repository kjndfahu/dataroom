import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  FoldersService,
  type FolderDetail,
  type SubtreeStats,
} from './folders.service.js';
import { ListingService, type FolderContents } from './listing.service.js';
import { CreateFolderDto } from './dto/create-folder.dto.js';
import { RenameFolderDto } from './dto/rename-folder.dto.js';
import { ListItemsQuery } from './dto/list-items.query.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('folders')
export class FoldersController {
  constructor(
    private readonly folders: FoldersService,
    private readonly listing: ListingService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFolderDto,
  ): Promise<FolderDetail> {
    return this.folders.create(user.id, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderDetail> {
    return this.folders.findOne(user.id, id);
  }

  @Get(':id/items')
  items(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListItemsQuery,
  ): Promise<FolderContents> {
    return this.listing.listFolder(user.id, id, query);
  }

  /** Totals shown in the delete confirmation before anything is removed. */
  @Get(':id/stats')
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubtreeStats> {
    return this.folders.subtreeStats(user.id, id);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFolderDto,
  ): Promise<FolderDetail> {
    return this.folders.rename(user.id, id, dto.name);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: SubtreeStats; orphanedObjects: number }> {
    return this.folders.remove(user.id, id);
  }
}
