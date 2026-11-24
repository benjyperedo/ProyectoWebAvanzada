
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { PREREQUISITOS } from '../academic-progress/prerequisites.js';

import {
  buscarHorarios,
  hayChoque,
  type PreferenciasHorario,
  type SeccionHorario,
} from './schedule-generator.algorithm.js';

// Período académico al que pertenece un horario
export interface PeriodoHorario {
  year: number;
  semester: number;
  isDemo: boolean;
}

@Injectable()
export class ScheduleGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================
  // GENERAR HORARIOS INTELIGENTES
  // ==========================================

  async generarParaEstudiante(
    userId: number,
    courseIds: number[],
  ) {
    // 1. Validar las asignaturas recibidas
    if (
      !Array.isArray(courseIds) ||
      courseIds.length === 0 ||
      courseIds.some(
        id => !Number.isInteger(id) || id <= 0,
      )
    ) {
      throw new BadRequestException(
        'Debes seleccionar asignaturas válidas.',
      );
    }

    const ids = [...new Set(courseIds)];

    // 2. Obtener las preferencias del estudiante
    const preferenciasGuardadas =
      await this.prisma.schedulePreference.findUnique({
        where: { userId },
      });

    const maxCursos =
      preferenciasGuardadas?.maxCourses ?? 5;

    if (ids.length > maxCursos) {
      throw new BadRequestException(
        `Puedes seleccionar como máximo ${maxCursos} asignaturas.`,
      );
    }

    const preferencias: PreferenciasHorario = {
      preferredShift:
        preferenciasGuardadas?.preferredShift ?? 'ANY',
      preferredFreeDay:
        preferenciasGuardadas?.preferredFreeDay ?? null,
      latestEndTime:
        preferenciasGuardadas?.latestEndTime ?? '18:00',
    };

    // 3. Comprobar que las asignaturas existan
    const cursos = await this.prisma.course.findMany({
      where: {
        id: { in: ids },
        active: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (cursos.length !== ids.length) {
      throw new BadRequestException(
        'Una o más asignaturas no están disponibles.',
      );
    }

    // 4. Obtener el progreso académico
    const progreso =
      await this.prisma.studentCourseProgress.findMany({
        where: { userId },
        select: {
          courseId: true,
          result: true,
        },
      });

    const idsAprobados = new Set(
      progreso
        .filter(item => item.result === 'APPROVED')
        .map(item => item.courseId),
    );

    const cursosAprobados =
      await this.prisma.course.findMany({
        where: {
          id: { in: [...idsAprobados] },
        },
        select: {
          code: true,
        },
      });

    const codigosAprobados = new Set(
      cursosAprobados.map(curso => curso.code),
    );

    // 5. Verificar que los ramos sean elegibles
    for (const curso of cursos) {
      if (idsAprobados.has(curso.id)) {
        throw new BadRequestException(
          `La asignatura ${curso.name} ya está aprobada.`,
        );
      }

      const requisitos =
        PREREQUISITOS[curso.code] ?? [];

      const faltantes = requisitos.filter(
        codigo => !codigosAprobados.has(codigo),
      );

      if (faltantes.length > 0) {
        throw new BadRequestException(
          `La asignatura ${curso.name} tiene prerrequisitos pendientes: ${faltantes.join(', ')}.`,
        );
      }
    }

    // 6. Buscar secciones del período de demostración
    const secciones =
      await this.prisma.courseSection.findMany({
        where: {
          courseId: { in: ids },
          year: 2027,
          semester: 1,
          isDemo: true,
          active: true,
        },
        include: {
          meetings: true,
        },
      });

    // 7. Agrupar las secciones por asignatura
    const opcionesPorRamo: SeccionHorario[][] =
      ids.map(courseId =>
        secciones
          .filter(
            seccion =>
              seccion.courseId === courseId &&
              seccion.meetings.length > 0,
          )
          .map(seccion => ({
            id: seccion.id,
            courseId: seccion.courseId,
            code: seccion.code,
            meetings: seccion.meetings.map(
              bloque => ({
                day: bloque.day,
                startTime: bloque.startTime,
                endTime: bloque.endTime,
              }),
            ),
          })),
      );

    // 8. Detectar asignaturas sin secciones
    const sinSecciones = ids.filter(
      (_, indice) =>
        opcionesPorRamo[indice].length === 0,
    );

    if (sinSecciones.length > 0) {
      const nombres = cursos
        .filter(curso =>
          sinSecciones.includes(curso.id),
        )
        .map(curso => curso.name);

      throw new BadRequestException(
        `No hay horarios de prueba disponibles para: ${nombres.join(', ')}.`,
      );
    }

        // 9. Ejecutar el algoritmo
    const { recommendations, truncated } = buscarHorarios(
      opcionesPorRamo,
      preferencias,
      10,
    );

    return {
      period: {
        year: 2027,
        semester: 1,
        isDemo: true,
      },
      selectedCourseIds: ids,
      totalRecommendations: recommendations.length,
      recommendations,
      truncated,
      message:
        recommendations.length > 0
          ? truncated
            ? 'Se muestran los mejores horarios encontrados. Hay tantas combinaciones que no se revisaron todas; prueba con menos ramos para ver más.'
            : 'Horarios generados correctamente.'
          : 'No se encontraron combinaciones sin choques.',
    };
  }

  // ==========================================
  // VALIDAR PERÍODO ACADÉMICO
  // ==========================================

  private validarPeriodo(periodo: PeriodoHorario): void {
    if (
      !periodo ||
      !Number.isInteger(periodo.year) ||
      periodo.year < 2000 ||
      periodo.year > 2100 ||
      ![1, 2].includes(periodo.semester) ||
      typeof periodo.isDemo !== 'boolean'
    ) {
      throw new BadRequestException(
        'El período académico indicado no es válido.',
      );
    }
  }

  // ==========================================
  // VALIDAR HORAS
  // ==========================================

  private convertirAMinutos(hora: string): number {
    if (
      typeof hora !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      throw new BadRequestException(
        'Se encontró un bloque con un formato horario inválido.',
      );
    }

    const [horas, minutos] = hora.split(':').map(Number);

    return horas * 60 + minutos;
  }

  // ==========================================
  // GUARDAR HORARIO DEL ESTUDIANTE
  // ==========================================

  async guardarParaEstudiante(
    userId: number,
    sectionIds: number[],
    periodo: PeriodoHorario,
  ) {
    // 1. Validar período
    this.validarPeriodo(periodo);

    // 2. Validar identificadores de secciones
    if (
      !Array.isArray(sectionIds) ||
      sectionIds.length === 0 ||
      sectionIds.some(
        id => !Number.isInteger(id) || id <= 0,
      )
    ) {
      throw new BadRequestException(
        'Debes seleccionar secciones válidas.',
      );
    }

    const ids = [...new Set(sectionIds)];

    if (ids.length !== sectionIds.length) {
      throw new BadRequestException(
        'No puedes repetir secciones en el mismo horario.',
      );
    }

    // 3. Comprobar cantidad máxima permitida
    const preferencias =
      await this.prisma.schedulePreference.findUnique({
        where: { userId },
      });

    const maxCursos = preferencias?.maxCourses ?? 5;

    if (ids.length > maxCursos) {
      throw new BadRequestException(
        `Puedes guardar como máximo ${maxCursos} asignaturas.`,
      );
    }

    // 4. Consultar las secciones reales de PostgreSQL
    const secciones =
      await this.prisma.courseSection.findMany({
        where: {
          id: { in: ids },
          year: periodo.year,
          semester: periodo.semester,
          isDemo: periodo.isDemo,
          active: true,
        },
        include: {
          course: true,
          meetings: true,
        },
      });

    if (secciones.length !== ids.length) {
      throw new BadRequestException(
        'Una o más secciones no están disponibles para el período indicado.',
      );
    }

    // 5. No permitir dos secciones del mismo ramo
    const idsCursos = new Set(
      secciones.map(seccion => seccion.courseId),
    );

    if (idsCursos.size !== secciones.length) {
      throw new BadRequestException(
        'No puedes guardar dos secciones de una misma asignatura.',
      );
    }

    // 6. Consultar las asignaturas aprobadas
    const progresoAprobado =
      await this.prisma.studentCourseProgress.findMany({
        where: {
          userId,
          result: 'APPROVED',
        },
        select: {
          courseId: true,
          course: {
            select: {
              code: true,
            },
          },
        },
      });

    const idsAprobados = new Set(
      progresoAprobado.map(item => item.courseId),
    );

    const codigosAprobados = new Set(
      progresoAprobado.map(item => item.course.code),
    );

    // 7. Validar elegibilidad y bloques horarios
    for (const seccion of secciones) {
      const curso = seccion.course;

      if (!curso.active) {
        throw new BadRequestException(
          `La asignatura ${curso.name} no está activa.`,
        );
      }

      if (idsAprobados.has(curso.id)) {
        throw new BadRequestException(
          `La asignatura ${curso.name} ya está aprobada.`,
        );
      }

      const requisitos =
        PREREQUISITOS[curso.code] ?? [];

      const faltantes = requisitos.filter(
        codigo => !codigosAprobados.has(codigo),
      );

      if (faltantes.length > 0) {
        throw new BadRequestException(
          `La asignatura ${curso.name} tiene prerrequisitos pendientes: ${faltantes.join(', ')}.`,
        );
      }

      if (seccion.meetings.length === 0) {
        throw new BadRequestException(
          `La sección ${seccion.code} de ${curso.name} no tiene bloques horarios.`,
        );
      }

      for (const bloque of seccion.meetings) {
        const inicio = this.convertirAMinutos(
          bloque.startTime,
        );

        const termino = this.convertirAMinutos(
          bloque.endTime,
        );

        if (inicio >= termino) {
          throw new BadRequestException(
            `La sección ${seccion.code} de ${curso.name} contiene un bloque horario inválido.`,
          );
        }
      }
    }

    // 8. Detectar choques entre todos los bloques
    const bloques = secciones.flatMap(seccion =>
      seccion.meetings.map(bloque => ({
        sectionId: seccion.id,
        day: bloque.day,
        startTime: bloque.startTime,
        endTime: bloque.endTime,
      })),
    );

    for (let i = 0; i < bloques.length; i++) {
      for (let j = i + 1; j < bloques.length; j++) {
        if (hayChoque(bloques[i], bloques[j])) {
          throw new BadRequestException(
            'El horario seleccionado contiene clases que se superponen.',
          );
        }
      }
    }

    // 9. Guardar o reemplazar el horario del período
    // Prisma ejecuta la operación anidada de forma atómica.
    await this.prisma.savedSchedule.upsert({
      where: {
        userId_year_semester_isDemo: {
          userId,
          year: periodo.year,
          semester: periodo.semester,
          isDemo: periodo.isDemo,
        },
      },
      create: {
        userId,
        year: periodo.year,
        semester: periodo.semester,
        isDemo: periodo.isDemo,
        sections: {
          create: ids.map(sectionId => ({
            section: {
              connect: { id: sectionId },
            },
          })),
        },
      },
      update: {
        sections: {
          deleteMany: {},
          create: ids.map(sectionId => ({
            section: {
              connect: { id: sectionId },
            },
          })),
        },
      },
    });

    // 10. Devolver el horario recién guardado
    return this.obtenerGuardado(userId, periodo);
  }

  // ==========================================
  // RECUPERAR HORARIO GUARDADO
  // ==========================================

  async obtenerGuardado(
    userId: number,
    periodo: PeriodoHorario,
  ) {
    this.validarPeriodo(periodo);

    // Buscar exclusivamente el horario del usuario autenticado
    const horario =
      await this.prisma.savedSchedule.findUnique({
        where: {
          userId_year_semester_isDemo: {
            userId,
            year: periodo.year,
            semester: periodo.semester,
            isDemo: periodo.isDemo,
          },
        },
        include: {
          sections: {
            include: {
              section: {
                include: {
                  course: true,
                  meetings: true,
                },
              },
            },
          },
        },
      });

    if (!horario) {
      return null;
    }

    // Preparar una respuesta fácil de utilizar en Angular
    const secciones = horario.sections
      .map(item => ({
        id: item.section.id,
        courseId: item.section.courseId,
        courseName: item.section.course.name,
        code: item.section.code,
        meetings: item.section.meetings.map(
          bloque => ({
            day: bloque.day,
            startTime: bloque.startTime,
            endTime: bloque.endTime,
            type: bloque.type,
          }),
        ),
      }))
      .sort((a, b) => a.courseId - b.courseId);

    return {
      id: horario.id,
      period: {
        year: horario.year,
        semester: horario.semester,
        isDemo: horario.isDemo,
      },
      sections: secciones,
      createdAt: horario.createdAt,
      updatedAt: horario.updatedAt,
    };
  }
}
