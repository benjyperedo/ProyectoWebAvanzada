
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';

import { Auth } from '../auth/auth.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

import { AcademicProgressService } from './academic-progress.service.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';

@Controller('academic-progress')
@Auth()
export class AcademicProgressController {
  constructor(
    private readonly progressService: AcademicProgressService,
  ) {}

  @Get()
  getMyProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService.findMine(user.sub);
  }

  @Put(':courseId')
  updateMyProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progressService.setMine(
      user.sub,
      courseId,
      dto.result,
    );
  }

  @Delete(':courseId')
  deleteMyProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseIntPipe) courseId: number,
  ) {
    return this.progressService.clearMine(user.sub, courseId);
  }
}
