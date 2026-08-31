import { Module } from '@nestjs/common';
import { DataRoomsController } from './datarooms.controller.js';
import { DataRoomsService } from './datarooms.service.js';
import { FoldersModule } from '../folders/folders.module.js';

@Module({
  imports: [FoldersModule],
  controllers: [DataRoomsController],
  providers: [DataRoomsService],
  exports: [DataRoomsService],
})
export class DataRoomsModule {}
