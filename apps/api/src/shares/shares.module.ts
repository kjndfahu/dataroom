import { Module } from '@nestjs/common';
import { SharesController } from './shares.controller.js';
import { SharesService } from './shares.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService],
})
export class SharesModule {}
