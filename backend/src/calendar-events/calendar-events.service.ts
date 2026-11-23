
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

// ==========================================
// TIPOS DE DATOS DEL CALENDARIO
// ==========================================

export type CalendarCategory =
  | 'UNIVERSITY'
  | 'PERSONAL';

export interface CreateCalendarEventBody {
  title: unknown;
  eventDate: unknown;
  startTime?: unknown;
  category: unknown;
  reminderMinutesBefore?: unknown;
}

export interface UpdateCalendarEventBody {
  title?: unknown;
  eventDate?: unknown;
  startTime?: unknown;
  category?: unknown;
  reminderMinutesBefore?: unknown;
}

@Injectable()
export class CalendarEventsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================
  // VALIDAR NOMBRE DEL EVENTO
  // ==========================================

  private validarTitulo(valor: unknown): string {
    if (typeof valor !== 'string') {
      throw new BadRequestException(
        'Debes ingresar el nombre del evento.',
      );
    }

    const titulo = valor.trim();

    if (titulo.length === 0 || titulo.length > 150) {
      throw new BadRequestException(
        'El nombre debe tener entre 1 y 150 caracteres.',
      );
    }

    return titulo;
  }

  // ==========================================
  // VALIDAR FECHA DEL EVENTO
  // ==========================================

  private validarFecha(valor: unknown): Date {
    if (
      typeof valor !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(valor)
    ) {
      throw new BadRequestException(
        'La fecha debe tener el formato YYYY-MM-DD.',
      );
    }

    const fecha = new Date(`${valor}T00:00:00.000Z`);

    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== valor
    ) {
      throw new BadRequestException(
        'La fecha ingresada no es válida.',
      );
    }

    return fecha;
  }

  // ==========================================
  // VALIDAR HORA DEL EVENTO
  // ==========================================

  private validarHora(valor: unknown): string | null {
    if (
      valor === null ||
      valor === undefined ||
      valor === ''
    ) {
      return null;
    }

    if (
      typeof valor !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)
    ) {
      throw new BadRequestException(
        'La hora debe tener el formato HH:MM.',
      );
    }

    return valor;
  }

  // ==========================================
  // VALIDAR CATEGORÍA
  // ==========================================

  private validarCategoria(
    valor: unknown,
  ): CalendarCategory {
    if (
      valor !== 'UNIVERSITY' &&
      valor !== 'PERSONAL'
    ) {
      throw new BadRequestException(
        'Selecciona una categoría válida: universidad o personal.',
      );
    }

    return valor;
  }

  // ==========================================
  // VALIDAR RECORDATORIO
  // ==========================================

  private validarRecordatorio(
    valor: unknown,
  ): number | null {
    if (
      valor === null ||
      valor === undefined
    ) {
      return null;
    }

    if (
      typeof valor !== 'number' ||
      !Number.isInteger(valor) ||
      valor < 0 ||
      valor > 1440
    ) {
      throw new BadRequestException(
        'El recordatorio debe estar entre 0 y 1440 minutos antes del evento.',
      );
    }

    return valor;
  }

  // ==========================================
  // PREPARAR FECHA PARA ANGULAR
  // ==========================================

  private formatearEvento<T extends { eventDate: Date }>(
    evento: T,
  ) {
    return {
      ...evento,
      eventDate: evento.eventDate
        .toISOString()
        .slice(0, 10),
    };
  }

  // ==========================================
  // CONSULTAR EVENTOS DEL ESTUDIANTE
  // ==========================================

  async listarEventos(
    userId: number,
    year?: number,
    month?: number,
  ) {
    let rangoFechas:
      | { gte: Date; lt: Date }
      | undefined;

    // Filtrar por mes cuando se indiquen año y mes.
    if (year !== undefined || month !== undefined) {
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        year === undefined ||
        month === undefined ||
        year < 1900 ||
        year > 2100 ||
        month < 1 ||
        month > 12
      ) {
        throw new BadRequestException(
          'Debes indicar un año y mes válidos.',
        );
      }

      rangoFechas = {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      };
    }

    const eventos =
      await this.prisma.calendarEvent.findMany({
        where: {
          userId,
          ...(rangoFechas
            ? { eventDate: rangoFechas }
            : {}),
        },
        orderBy: [
          { eventDate: 'asc' },
          { startTime: 'asc' },
          { id: 'asc' },
        ],
      });

    return eventos.map(evento =>
      this.formatearEvento(evento),
    );
  }

  // ==========================================
  // CREAR UN EVENTO
  // ==========================================

  async crearEvento(
    userId: number,
    body: CreateCalendarEventBody,
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException(
        'Debes ingresar los datos del evento.',
      );
    }

    const title = this.validarTitulo(body.title);

    const eventDate = this.validarFecha(
      body.eventDate,
    );

    const startTime = this.validarHora(
      body.startTime,
    );

    const category = this.validarCategoria(
      body.category,
    );

    const reminderMinutesBefore =
      this.validarRecordatorio(
        body.reminderMinutesBefore,
      );

    // Una alarma requiere conocer la hora del evento.
    if (
      reminderMinutesBefore !== null &&
      startTime === null
    ) {
      throw new BadRequestException(
        'Debes indicar una hora para activar el recordatorio.',
      );
    }

    const evento =
      await this.prisma.calendarEvent.create({
        data: {
          userId,
          title,
          eventDate,
          startTime,
          category,
          reminderMinutesBefore,
        },
      });

    return this.formatearEvento(evento);
  }

  // ==========================================
  // EDITAR UN EVENTO
  // ==========================================

  async actualizarEvento(
    userId: number,
    eventId: number,
    body: UpdateCalendarEventBody,
  ) {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException(
        'Debes ingresar los cambios del evento.',
      );
    }

    // Buscar exclusivamente entre los eventos del usuario.
    const existente =
      await this.prisma.calendarEvent.findFirst({
        where: {
          id: eventId,
          userId,
        },
      });

    if (!existente) {
      throw new NotFoundException(
        'No se encontró el evento solicitado.',
      );
    }

    // Mantener los valores anteriores cuando
    // el estudiante no modifica un campo.
    const title =
      body.title === undefined
        ? existente.title
        : this.validarTitulo(body.title);

    const eventDate =
      body.eventDate === undefined
        ? existente.eventDate
        : this.validarFecha(body.eventDate);

    const startTime =
      body.startTime === undefined
        ? existente.startTime
        : this.validarHora(body.startTime);

    const category =
      body.category === undefined
        ? existente.category
        : this.validarCategoria(body.category);

    const reminderMinutesBefore =
      body.reminderMinutesBefore === undefined
        ? existente.reminderMinutesBefore
        : this.validarRecordatorio(
            body.reminderMinutesBefore,
          );

    if (
      reminderMinutesBefore !== null &&
      startTime === null
    ) {
      throw new BadRequestException(
        'Un evento con recordatorio debe tener una hora.',
      );
    }

    // Incluir userId en la actualización
    // para impedir modificar eventos ajenos.
    const resultado =
      await this.prisma.calendarEvent.updateMany({
        where: {
          id: eventId,
          userId,
        },
        data: {
          title,
          eventDate,
          startTime,
          category,
          reminderMinutesBefore,
        },
      });

    if (resultado.count === 0) {
      throw new NotFoundException(
        'El evento ya no está disponible.',
      );
    }

    const actualizado =
      await this.prisma.calendarEvent.findFirst({
        where: {
          id: eventId,
          userId,
        },
      });

    if (!actualizado) {
      throw new NotFoundException(
        'No se encontró el evento actualizado.',
      );
    }

    return this.formatearEvento(actualizado);
  }

  // ==========================================
  // ELIMINAR UN EVENTO
  // ==========================================

  async eliminarEvento(
    userId: number,
    eventId: number,
  ) {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }

    const resultado =
      await this.prisma.calendarEvent.deleteMany({
        where: {
          id: eventId,
          userId,
        },
      });

    if (resultado.count === 0) {
      throw new NotFoundException(
        'No se encontró el evento solicitado.',
      );
    }

    return {
      deleted: true,
      id: eventId,
    };
  }
}
