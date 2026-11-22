
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AcademicProgressController } from './academic-progress.controller.js';
import { AcademicProgressService } from './academic-progress.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AcademicProgressController],
  providers: [AcademicProgressService],
})
export class AcademicProgressModule {}
