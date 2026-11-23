
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { Auth } from '../auth/auth.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

import {
  CalendarEventsService,
  type CreateCalendarEventBody,
  type UpdateCalendarEventBody,
} from './calendar-events.service.js';

@Controller('calendar-events')
export class CalendarEventsController {
  constructor(
    private readonly calendarEventsService: CalendarEventsService,
  ) {}

  // ==========================================
  // OBTENER EL ESTUDIANTE AUTENTICADO
  // ==========================================

  private obtenerUserId(
    request: AuthenticatedRequest,
  ): number {
    const userId = request.user?.sub;

    if (userId === undefined) {
      throw new UnauthorizedException(
        'Debes iniciar sesión para utilizar el calendario.',
      );
    }

    return userId;
  }

  // ==========================================
  // CONSULTAR EVENTOS DEL CALENDARIO
  // ==========================================

  @Get()
  @Auth()
  obtenerEventos(
    @Req() request: AuthenticatedRequest,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const userId = this.obtenerUserId(request);

    // Los filtros son opcionales.
    // Si se indican, deben corresponder
    // a un año y un mes válidos.
    const anio =
      year === undefined
        ? undefined
        : Number(year);

    const mes =
      month === undefined
        ? undefined
        : Number(month);

    return this.calendarEventsService.listarEventos(
      userId,
      anio,
      mes,
    );
  }

  // ==========================================
  // CREAR UN EVENTO
  // ==========================================

  @Post()
  @Auth()
  crearEvento(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateCalendarEventBody,
  ) {
    const userId = this.obtenerUserId(request);

    return this.calendarEventsService.crearEvento(
      userId,
      body,
    );
  }

  // ==========================================
  // EDITAR UN EVENTO
  // ==========================================

  @Patch(':id')
  @Auth()
  actualizarEvento(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: UpdateCalendarEventBody,
  ) {
    const userId = this.obtenerUserId(request);

    return this.calendarEventsService.actualizarEvento(
      userId,
      eventId,
      body,
    );
  }

  // ==========================================
  // ELIMINAR UN EVENTO
  // ==========================================

  @Delete(':id')
  @Auth()
  eliminarEvento(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) eventId: number,
  ) {
    const userId = this.obtenerUserId(request);

    return this.calendarEventsService.eliminarEvento(
      userId,
      eventId,
    );
  }
}
