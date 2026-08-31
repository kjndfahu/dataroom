import { Module } from '@nestjs/common';
import { DataRoomsController } from './datarooms.controller.js';
import { DataRoomsService } from './datarooms.service.js';

@Module({
  controllers: [DataRoomsController],
  providers: [DataRoomsService],
  exports: [DataRoomsService],
})
export class DataRoomsModule {}
