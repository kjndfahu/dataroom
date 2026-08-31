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
  SharesService,
  type ReceivedShare,
  type ShareSummary,
} from './shares.service.js';
import { CreateShareDto } from './dto/create-share.dto.js';
import { ResourceQuery } from './dto/resource.query.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShareDto,
  ): Promise<ShareSummary> {
    return this.shares.create(user.id, dto);
  }

  /** Active shares on one resource — the owner's view. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ResourceQuery,
  ): Promise<ShareSummary[]> {
    return this.shares.listForResource(user.id, query);
  }

  /** Everything shared with the signed-in user. */
  @Get('received')
  received(@CurrentUser() user: AuthenticatedUser): Promise<ReceivedShare[]> {
    return this.shares.listReceived(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.shares.revoke(user.id, id);
  }
}
