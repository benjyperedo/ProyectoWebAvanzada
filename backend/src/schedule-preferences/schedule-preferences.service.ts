
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSchedulePreferencesDto } from './dto/update-schedule-preferences.dto.js';

@Injectable()
export class SchedulePreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Consultar las preferencias del estudiante
  async findMine(userId: number) {
    const preferencias = await this.prisma.schedulePreference.findUnique({
      where: { userId },
    });

    // Si aún no ha guardado preferencias,
    // entregamos los valores predeterminados.
    if (!preferencias) {
      return {
        preferredShift: 'ANY',
        preferredFreeDay: null,
        latestEndTime: '18:00',
        maxCourses: 5,
      };
    }

    return {
      preferredShift: preferencias.preferredShift,
      preferredFreeDay: preferencias.preferredFreeDay,
      latestEndTime: preferencias.latestEndTime,
      maxCourses: preferencias.maxCourses,
    };
  }

  // 2. Guardar o actualizar las preferencias del estudiante
  async saveMine(
    userId: number,
    dto: UpdateSchedulePreferencesDto,
  ) {
    return this.prisma.schedulePreference.upsert({
      where: { userId },

      // Si es la primera vez, creamos el registro
      create: {
        userId,
        preferredShift: dto.preferredShift,
        preferredFreeDay: dto.preferredFreeDay,
        latestEndTime: dto.latestEndTime,
        maxCourses: dto.maxCourses,
      },

      // Si ya existe, actualizamos sus preferencias
      update: {
        preferredShift: dto.preferredShift,
        preferredFreeDay: dto.preferredFreeDay,
        latestEndTime: dto.latestEndTime,
        maxCourses: dto.maxCourses,
      },
    });
  }
}
