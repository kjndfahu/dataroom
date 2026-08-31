import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  PublicLinksService,
  type PublicLinkSummary,
} from './public-links.service.js';
import { CreatePublicLinkDto } from './dto/create-public-link.dto.js';
import { ResourceQuery } from '../shares/dto/resource.query.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('public-links')
export class PublicLinksController {
  constructor(private readonly links: PublicLinksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePublicLinkDto,
  ): Promise<PublicLinkSummary> {
    return this.links.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ResourceQuery,
  ): Promise<PublicLinkSummary[]> {
    return this.links.listForResource(user.id, query);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.links.revoke(user.id, id);
  }
}
