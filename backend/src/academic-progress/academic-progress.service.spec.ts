import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AcademicProgressService } from './academic-progress.service.js';
import {
  dependientesDe,
  prerrequisitosFaltantes,
} from './prerequisites.js';

describe('prerrequisitosFaltantes', () => {
  it('una asignatura sin prerrequisitos no tiene faltantes', () => {
    expect(prerrequisitosFaltantes('ingles-1', new Set())).toEqual([]);
  });

  it('devuelve solo los prerrequisitos que no están aprobados', () => {
    const aprobados = new Set(['estructura-de-datos']);

    expect(prerrequisitosFaltantes('programacion-avanzada', aprobados)).toEqual(
      [],
    );
    expect(prerrequisitosFaltantes('programacion-avanzada', new Set())).toEqual(
      ['estructura-de-datos'],
    );
  });

  it('exige todos los prerrequisitos, no solo uno', () => {
    const faltan = prerrequisitosFaltantes(
      'seminario-de-titulo',
      new Set(['ciberseguridad']),
    );

    expect(faltan).not.toContain('ciberseguridad');
    expect(faltan.length).toBeGreaterThan(5);
  });
});

describe('dependientesDe', () => {
  it('lista las asignaturas que requieren la indicada', () => {
    expect(dependientesDe('ingles-1')).toEqual(['ingles-2']);
    expect(dependientesDe('redes-de-computadores')).toEqual(
      expect.arrayContaining(['ciberseguridad', 'seminario-de-titulo']),
    );
  });

  it('devuelve vacío si nadie depende de ella', () => {
    expect(dependientesDe('proyecto-de-titulo')).toEqual([]);
  });
});

// Mallas de prueba: id -> código/nombre
const MALLA = [
  { id: 1, code: 'ingles-1', name: 'Inglés 1' },
  { id: 2, code: 'ingles-2', name: 'Inglés 2' },
  { id: 3, code: 'ingles-3', name: 'Inglés 3' },
];

function setup(registros: { courseId: number; result: string }[] = []) {
  const prisma = {
    course: {
      findFirst: vi.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(MALLA.find((c) => c.id === where.id) ?? null),
      ),
      findMany: vi.fn(
        ({ where }: { where: { code: { in: string[] } } }) =>
          Promise.resolve(MALLA.filter((c) => where.code.in.includes(c.code))),
      ),
    },
    studentCourseProgress: {
      findMany: vi.fn(() =>
        Promise.resolve(
          registros.map((r) => ({
            ...r,
            course: MALLA.find((c) => c.id === r.courseId)!,
          })),
        ),
      ),
      upsert: vi.fn().mockResolvedValue({ ok: true }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const service = new AcademicProgressService(prisma as unknown as PrismaService);

  return { prisma, service };
}

describe('AcademicProgressService.setMine', () => {
  it('rechaza una asignatura inexistente', async () => {
    const { service } = setup();

    await expect(service.setMine(1, 99, 'APPROVED' as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('permite registrar una asignatura sin prerrequisitos', async () => {
    const { service, prisma } = setup();

    await service.setMine(1, 1, 'APPROVED' as never);

    expect(prisma.studentCourseProgress.upsert).toHaveBeenCalledOnce();
  });

  it('bloquea aprobar un ramo sin su prerrequisito y nombra el que falta', async () => {
    const { service, prisma } = setup();

    await expect(service.setMine(1, 2, 'APPROVED' as never)).rejects.toThrow(
      /Inglés 1/,
    );
    expect(prisma.studentCourseProgress.upsert).not.toHaveBeenCalled();
  });

  it('también bloquea marcarlo como reprobado sin el prerrequisito', async () => {
    const { service } = setup();

    await expect(service.setMine(1, 2, 'FAILED' as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('permite aprobar cuando el prerrequisito ya está aprobado', async () => {
    const { service, prisma } = setup([{ courseId: 1, result: 'APPROVED' }]);

    await service.setMine(1, 2, 'APPROVED' as never);

    expect(prisma.studentCourseProgress.upsert).toHaveBeenCalledOnce();
  });

  it('no deja desaprobar un ramo si otro que depende de él tiene resultado', async () => {
    const { service, prisma } = setup([
      { courseId: 1, result: 'APPROVED' },
      { courseId: 2, result: 'APPROVED' },
    ]);

    await expect(service.setMine(1, 1, 'FAILED' as never)).rejects.toThrow(
      /Inglés 2/,
    );
    expect(prisma.studentCourseProgress.upsert).not.toHaveBeenCalled();
  });

  it('deja cambiar un ramo aprobado si nadie depende de él todavía', async () => {
    const { service, prisma } = setup([{ courseId: 1, result: 'APPROVED' }]);

    await service.setMine(1, 1, 'FAILED' as never);

    expect(prisma.studentCourseProgress.upsert).toHaveBeenCalledOnce();
  });
});

describe('AcademicProgressService.clearMine', () => {
  it('no deja quitar una aprobación de la que dependen otros resultados', async () => {
    const { service, prisma } = setup([
      { courseId: 1, result: 'APPROVED' },
      { courseId: 2, result: 'FAILED' },
    ]);

    await expect(service.clearMine(1, 1)).rejects.toThrow(/Inglés 2/);
    expect(prisma.studentCourseProgress.deleteMany).not.toHaveBeenCalled();
  });

  it('quita el resultado si no hay dependientes', async () => {
    const { service, prisma } = setup([{ courseId: 3, result: 'FAILED' }]);

    await expect(service.clearMine(1, 3)).resolves.toEqual({
      courseId: 3,
      cleared: true,
    });
    expect(prisma.studentCourseProgress.deleteMany).toHaveBeenCalledOnce();
  });
});