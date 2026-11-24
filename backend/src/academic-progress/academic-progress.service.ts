import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
// Mismos valores que el enum CourseResult de Prisma
type ResultadoCurso = 'APPROVED' | 'FAILED';
import {
  PREREQUISITOS,
  dependientesDe,
  prerrequisitosFaltantes,
} from './prerequisites.js';

// Un resultado registrado junto con los datos de su asignatura
interface RegistroProgreso {
  courseId: number;
  result: ResultadoCurso;
  course: { code: string; name: string };
}

@Injectable()
export class AcademicProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // Consultar el progreso y calcular asignaturas habilitadas
  async findMine(userId: number) {
    const progress = await this.prisma.studentCourseProgress.findMany({
      where: { userId },
      select: { courseId: true, result: true },
    });

    const cursos = await this.prisma.course.findMany({
      where: { active: true },
      select: { id: true, code: true },
    });

    const codigosPorId = new Map(cursos.map((c) => [c.id, c.code]));

    const aprobados = new Set<string>();

    for (const p of progress) {
      const codigo = codigosPorId.get(p.courseId);

      if (p.result === 'APPROVED' && codigo !== undefined) {
        aprobados.add(codigo);
      }
    }

    const eligibility = cursos.map((curso) => {
      const faltantes = prerrequisitosFaltantes(curso.code, aprobados);

      return {
        courseId: curso.id,
        code: curso.code,
        status: faltantes.length === 0 ? 'AVAILABLE' : 'BLOCKED',
        missingPrerequisites: faltantes,
      };
    });

    return { progress, prerequisites: PREREQUISITOS, eligibility };
  }

  // Registro del estudiante con el código y nombre de cada asignatura
  private async progresoConCursos(
    userId: number,
  ): Promise<RegistroProgreso[]> {
    return this.prisma.studentCourseProgress.findMany({
      where: { userId },
      select: {
        courseId: true,
        result: true,
        course: { select: { code: true, name: true } },
      },
    });
  }

  // Convierte códigos en nombres legibles para los mensajes de error
  private async nombresDe(codigos: string[]): Promise<string[]> {
    const cursos = await this.prisma.course.findMany({
      where: { code: { in: codigos } },
      select: { code: true, name: true },
    });

    const nombres = new Map(cursos.map((c) => [c.code, c.name]));

    return codigos.map((codigo) => nombres.get(codigo) ?? codigo);
  }

  // No se puede quitar una aprobación si otros ramos ya dependen de ella
  private validarSinDependientes(
    courseCode: string,
    registros: RegistroProgreso[],
  ): void {
    const dependientes = new Set(dependientesDe(courseCode));

    const conResultado = registros
      .filter((r) => dependientes.has(r.course.code))
      .map((r) => r.course.name);

    if (conResultado.length > 0) {
      throw new BadRequestException(
        `No puedes quitar esta aprobación porque ya registraste resultados en: ${conResultado.join(', ')}. Quita primero esos resultados.`,
      );
    }
  }

  // Aprobar o reprobar una asignatura
  async setMine(userId: number, courseId: number, result: ResultadoCurso) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, active: true },
    });

    if (!course) {
      throw new NotFoundException('La asignatura no está disponible');
    }

    const registros = await this.progresoConCursos(userId);

    // Regla 1: solo se registra un resultado si están aprobados
    // todos sus prerrequisitos.
    const aprobados = new Set(
      registros
        .filter((r) => r.result === 'APPROVED')
        .map((r) => r.course.code),
    );

    const faltantes = prerrequisitosFaltantes(course.code, aprobados);

    if (faltantes.length > 0) {
      const nombres = await this.nombresDe(faltantes);

      throw new BadRequestException(
        `No puedes registrar ${course.name}: faltan los prerrequisitos ${nombres.join(', ')}.`,
      );
    }

    // Regla 2: si estaba aprobada y ahora deja de estarlo,
    // ningún ramo que dependa de ella puede tener resultado.
    const actual = registros.find((r) => r.courseId === courseId);

    if (
      actual?.result === 'APPROVED' &&
      result !== 'APPROVED'
    ) {
      this.validarSinDependientes(course.code, registros);
    }

    return this.prisma.studentCourseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, result },
      update: { result },
    });
  }

  // Quitar el resultado de una asignatura
  async clearMine(userId: number, courseId: number) {
    const registros = await this.progresoConCursos(userId);
    const actual = registros.find((r) => r.courseId === courseId);

    if (actual?.result === 'APPROVED') {
      this.validarSinDependientes(actual.course.code, registros);
    }

    await this.prisma.studentCourseProgress.deleteMany({
      where: { userId, courseId },
    });

    return { courseId, cleared: true };
  }
}