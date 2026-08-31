import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  DataRoomsService,
  type DataRoomDetail,
  type DataRoomSummary,
} from './datarooms.service.js';
import { CreateDataRoomDto } from './dto/create-data-room.dto.js';
import {
  ListingService,
  type FolderContents,
} from '../folders/listing.service.js';
import { ListItemsQuery } from '../folders/dto/list-items.query.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('datarooms')
export class DataRoomsController {
  constructor(
    private readonly dataRooms: DataRoomsService,
    private readonly listing: ListingService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ owned: DataRoomSummary[]; shared: DataRoomSummary[] }> {
    return this.dataRooms.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDataRoomDto,
  ): Promise<DataRoomSummary> {
    return this.dataRooms.create(user.id, dto.name);
  }

  /** Items at the root of the data room — the folders and files with no parent. */
  @Get(':id/items')
  items(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListItemsQuery,
  ): Promise<FolderContents> {
    return this.listing.listDataRoomRoot(user.id, id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DataRoomDetail> {
    return this.dataRooms.findOne(user.id, id);
  }
}
