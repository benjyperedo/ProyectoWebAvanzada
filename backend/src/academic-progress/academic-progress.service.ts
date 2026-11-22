
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CourseResult } from '../generated/prisma/enums.js';
import { PREREQUISITOS } from './prerequisites.js';

@Injectable()
export class AcademicProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // Consultar el progreso y calcular asignaturas habilitadas
  async findMine(userId: number) {

    // 1. Obtener el progreso del estudiante
    const progress = await this.prisma.studentCourseProgress.findMany({
      where: { userId },
      select: {
        courseId: true,
        result: true,
      },
    });

    // 2. Obtener las asignaturas activas de la malla
    const cursos = await this.prisma.course.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
      },
    });

    // 3. Relacionar IDs con códigos de asignaturas
    const codigosPorId = new Map(
      cursos.map(curso => [curso.id, curso.code]),
    );

    // 4. Identificar qué asignaturas están aprobadas
    const aprobados = new Set(
      progress
        .filter(p => p.result === CourseResult.APPROVED)
        .map(p => codigosPorId.get(p.courseId))
        .filter((codigo): codigo is string => codigo !== undefined),
    );

    // 5. Calcular los prerrequisitos de cada asignatura
    const eligibility = cursos.map(curso => {

      // Si no aparece en el listado, no tiene prerrequisitos
      const requisitos = PREREQUISITOS[curso.code] ?? [];

      // Identificar los prerrequisitos no aprobados
      const faltantes = requisitos.filter(
        requisito => !aprobados.has(requisito),
      );

      return {
        courseId: curso.id,
        code: curso.code,
        status: faltantes.length === 0
          ? 'AVAILABLE'
          : 'BLOCKED',
        missingPrerequisites: faltantes,
      };
    });

    // 6. Entregar los resultados al frontend
    return {
      progress,
      prerequisites: PREREQUISITOS,
      eligibility,
    };
  }

  // Aprobar o reprobar una asignatura
  async setMine(
    userId: number,
    courseId: number,
    result: CourseResult,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, active: true },
    });

    if (!course) {
      throw new NotFoundException(
        'La asignatura no está disponible',
      );
    }

    return this.prisma.studentCourseProgress.upsert({
      where: {
        userId_courseId: { userId, courseId },
      },
      create: { userId, courseId, result },
      update: { result },
    });
  }

  // Quitar el resultado de una asignatura
  async clearMine(userId: number, courseId: number) {
    await this.prisma.studentCourseProgress.deleteMany({
      where: { userId, courseId },
    });

    return { courseId, cleared: true };
  }
}
