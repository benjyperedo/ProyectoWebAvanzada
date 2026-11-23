
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { ScheduleGeneratorController } from './schedule-generator.controller.js';
import { ScheduleGeneratorService } from './schedule-generator.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    ScheduleGeneratorController,
  ],
  providers: [
    ScheduleGeneratorService,
  ],
})
export class ScheduleGeneratorModule {}
