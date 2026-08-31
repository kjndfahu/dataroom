import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  PublicAccessService,
  type PublicView,
} from './public-access.service.js';
import { PublicItemsQuery } from './dto/public-items.query.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { FolderContents } from '../folders/listing.service.js';

/**
 * Anonymous, read-only browsing of one shared resource. Every route re-resolves
 * the token, so disabling a link takes effect on the next request.
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly access: PublicAccessService) {}

  @Get(':token')
  view(
    @Param('token') token: string,
    @Query('folderId') folderId?: string,
  ): Promise<PublicView> {
    return this.access.view(token, folderId);
  }

  @Get(':token/items')
  items(
    @Param('token') token: string,
    @Query() query: PublicItemsQuery,
  ): Promise<FolderContents> {
    return this.access.listItems(token, query.folderId, query);
  }

  @Get(':token/files/:fileId/preview')
  preview(
    @Param('token') token: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<{ url: string; name: string; size: number; expiresIn: number }> {
    return this.access.previewFile(token, fileId);
  }
}
