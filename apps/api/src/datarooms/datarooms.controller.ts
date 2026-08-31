import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  DataRoomsService,
  type DataRoomDetail,
  type DataRoomSummary,
} from './datarooms.service.js';
import { CreateDataRoomDto } from './dto/create-data-room.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('datarooms')
export class DataRoomsController {
  constructor(private readonly dataRooms: DataRoomsService) {}

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

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DataRoomDetail> {
    return this.dataRooms.findOne(user.id, id);
  }
}
