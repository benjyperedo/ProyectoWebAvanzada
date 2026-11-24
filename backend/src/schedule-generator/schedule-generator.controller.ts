
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Auth } from '../auth/auth.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PERIODO_ACTUAL } from './periodo.js';

import {
  ScheduleGeneratorService,
  type PeriodoHorario,
} from './schedule-generator.service.js';

@Controller('schedule-generator')
export class ScheduleGeneratorController {
  constructor(
    private readonly scheduleGeneratorService: ScheduleGeneratorService,
  ) {}

  // ==========================================
  // OBTENER EL ID DEL ESTUDIANTE AUTENTICADO
  // ==========================================

  private obtenerUserId(
    request: AuthenticatedRequest,
  ): number {
    const userId = request.user?.sub;

    if (userId === undefined) {
      throw new UnauthorizedException(
        'Debes iniciar sesión para utilizar el generador.',
      );
    }

    return userId;
  }

  // ==========================================
  // GENERAR HORARIOS INTELIGENTES
  // ==========================================

  @Post('generate')
  @Auth()
  generarHorarios(
    @Req() request: AuthenticatedRequest,
    @Body() body: { courseIds: number[] },
  ) {
    const userId = this.obtenerUserId(request);

    return this.scheduleGeneratorService.generarParaEstudiante(
      userId,
      body?.courseIds ?? [],
    );
  }

  // ==========================================
  // GUARDAR EL HORARIO ELEGIDO
  // ==========================================

  @Post('save')
  @Auth()
  guardarHorario(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      sectionIds: number[];
      period: PeriodoHorario;
    },
  ) {
    const userId = this.obtenerUserId(request);

    return this.scheduleGeneratorService.guardarParaEstudiante(
      userId,
      body?.sectionIds ?? [],
      body?.period,
    );
  }

  // ==========================================
  // RECUPERAR EL HORARIO GUARDADO
  // ==========================================

  @Get('saved')
  @Auth()
  obtenerHorarioGuardado(
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.obtenerUserId(request);

    // Se usa el período vigente de la aplicación.
    const periodo: PeriodoHorario = { ...PERIODO_ACTUAL };

    return this.scheduleGeneratorService.obtenerGuardado(
      userId,
      periodo,
    );
  }
}
