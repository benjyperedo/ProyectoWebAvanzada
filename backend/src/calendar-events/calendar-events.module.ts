
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

import { CalendarEventsController } from './calendar-events.controller.js';
import { CalendarEventsService } from './calendar-events.service.js';

// ==========================================
// MÓDULO DE EVENTOS DEL CALENDARIO
// ==========================================

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    CalendarEventsController,
  ],

  providers: [
    CalendarEventsService,
  ],
})
export class CalendarEventsModule {}
