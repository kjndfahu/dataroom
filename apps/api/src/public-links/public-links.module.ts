import { Module } from '@nestjs/common';
import { PublicLinksController } from './public-links.controller.js';
import { PublicController } from './public.controller.js';
import { PublicLinksService } from './public-links.service.js';
import { PublicAccessService } from './public-access.service.js';
import { SharesModule } from '../shares/shares.module.js';
import { FoldersModule } from '../folders/folders.module.js';
import { FilesModule } from '../files/files.module.js';

@Module({
  imports: [SharesModule, FoldersModule, FilesModule],
  controllers: [PublicLinksController, PublicController],
  providers: [PublicLinksService, PublicAccessService],
})
export class PublicLinksModule {}
