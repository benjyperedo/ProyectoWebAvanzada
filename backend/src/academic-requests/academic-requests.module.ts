
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

import {
  AcademicRequestsController,
} from './academic-requests.controller.js';

import {
  AcademicRequestsService,
} from './academic-requests.service.js';

// ==========================================
// MÓDULO DE TRÁMITES ACADÉMICOS
// ==========================================

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    AcademicRequestsController,
  ],

  providers: [
    AcademicRequestsService,
  ],
})
export class AcademicRequestsModule {}
