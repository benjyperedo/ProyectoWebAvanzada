import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PythonModule } from './python/python.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { AcademicProgressModule } from './academic-progress/academic-progress.module.js';
import { SchedulePreferencesModule } from './schedule-preferences/schedule-preferences.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    CoursesModule,
    AuthModule,
    PythonModule,
    IngestionModule,
    AcademicProgressModule,
    SchedulePreferencesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}