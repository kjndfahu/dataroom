import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller.js';
import { FoldersService } from './folders.service.js';
import { ListingService } from './listing.service.js';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService, ListingService],
  exports: [FoldersService, ListingService],
})
export class FoldersModule {}
