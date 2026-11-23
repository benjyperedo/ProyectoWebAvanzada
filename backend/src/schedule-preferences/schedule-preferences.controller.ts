
import { Body, Controller, Get, Put } from '@nestjs/common';

import { Auth } from '../auth/auth.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

import { SchedulePreferencesService } from './schedule-preferences.service.js';
import { UpdateSchedulePreferencesDto } from './dto/update-schedule-preferences.dto.js';

@Controller('schedule-preferences')
@Auth()
export class SchedulePreferencesController {
  constructor(
    private readonly preferencesService: SchedulePreferencesService,
  ) {}

  // 1. Obtener las preferencias del estudiante autenticado
  @Get()
  getMyPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.preferencesService.findMine(user.sub);
  }

  // 2. Guardar o actualizar las preferencias del estudiante
  @Put()
  updateMyPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSchedulePreferencesDto,
  ) {
    return this.preferencesService.saveMine(user.sub, dto);
  }
}
