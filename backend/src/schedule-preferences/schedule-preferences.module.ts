
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { SchedulePreferencesController } from './schedule-preferences.controller.js';
import { SchedulePreferencesService } from './schedule-preferences.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SchedulePreferencesController],
  providers: [SchedulePreferencesService],
})
export class SchedulePreferencesModule {}
