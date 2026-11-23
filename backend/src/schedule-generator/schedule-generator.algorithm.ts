
//
// LISTOCO - Algoritmo generador de horarios
//

export type DiaSemana =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';

export interface BloqueHorario {
  day: DiaSemana;
  startTime: string;
  endTime: string;
}

export interface SeccionHorario {
  id: number;
  courseId: number;
  code: string;
  meetings: BloqueHorario[];
}

export interface PreferenciasHorario {
  preferredShift: 'ANY' | 'MORNING' | 'AFTERNOON';
  preferredFreeDay: DiaSemana | null;
  latestEndTime: string;
}

export interface HorarioRecomendado {
  sections: SeccionHorario[];
  score: number;
}

// Convierte una hora "HH:mm" a minutos.
function convertirAMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

// Detecta si dos bloques se superponen.
export function hayChoque(
  primero: BloqueHorario,
  segundo: BloqueHorario,
): boolean {
  if (primero.day !== segundo.day) {
    return false;
  }

  const inicioA = convertirAMinutos(primero.startTime);
  const terminoA = convertirAMinutos(primero.endTime);
  const inicioB = convertirAMinutos(segundo.startTime);
  const terminoB = convertirAMinutos(segundo.endTime);

  return inicioA < terminoB && inicioB < terminoA;
}

// Calcula qué tan bien se ajusta un horario
// a las preferencias del estudiante.
function calcularPuntaje(
  secciones: SeccionHorario[],
  preferencias: PreferenciasHorario,
): number {
  const bloques = secciones.flatMap(
    (seccion) => seccion.meetings,
  );

  let puntaje = 0;

  // Premiar que el día preferido quede libre.
  if (
    preferencias.preferredFreeDay &&
    bloques.every(
      (bloque) =>
        bloque.day !== preferencias.preferredFreeDay,
    )
  ) {
    puntaje += 20;
  }

  const mediodia = convertirAMinutos('12:00');
  const horaLimite = convertirAMinutos(
    preferencias.latestEndTime,
  );

  for (const bloque of bloques) {
    const inicio = convertirAMinutos(bloque.startTime);
    const termino = convertirAMinutos(bloque.endTime);

    // Premiar la jornada preferida.
    if (
      preferencias.preferredShift === 'MORNING' &&
      inicio < mediodia
    ) {
      puntaje += 3;
    }

    if (
      preferencias.preferredShift === 'AFTERNOON' &&
      inicio >= mediodia
    ) {
      puntaje += 3;
    }

    // Penalizar clases que terminen después
    // de la hora máxima preferida.
    if (termino > horaLimite) {
      puntaje -= 10;
    }
  }

  return puntaje;
}

// Construye combinaciones sin choques horarios.
export function generarHorarios(
  opcionesPorRamo: SeccionHorario[][],
  preferencias: PreferenciasHorario,
  limiteResultados = 10,
): HorarioRecomendado[] {
  if (
    opcionesPorRamo.length === 0 ||
    opcionesPorRamo.some(
      (secciones) => secciones.length === 0,
    )
  ) {
    return [];
  }

  const resultados: HorarioRecomendado[] = [];

  function explorar(
    indiceRamo: number,
    seleccionadas: SeccionHorario[],
  ): void {
    // Ya elegimos una sección de cada ramo.
    if (indiceRamo === opcionesPorRamo.length) {
      resultados.push({
        sections: [...seleccionadas],
        score: calcularPuntaje(
          seleccionadas,
          preferencias,
        ),
      });

      return;
    }

    // Probar cada sección del ramo actual.
    for (const seccion of opcionesPorRamo[indiceRamo]) {
      // Comprobar que la sección no tenga
      // conflictos internos entre sus bloques.
      const conflictoInterno = seccion.meetings.some(
        (bloque, indice) =>
          seccion.meetings
            .slice(indice + 1)
            .some((otro) => hayChoque(bloque, otro)),
      );

      if (conflictoInterno) {
        continue;
      }

      // Comprobar conflictos con las secciones
      // que ya fueron seleccionadas.
      const tieneChoque = seleccionadas.some(
        (anterior) =>
          seccion.meetings.some((bloque) =>
            anterior.meetings.some((otro) =>
              hayChoque(bloque, otro),
            ),
          ),
      );

      // Descartar la combinación si hay choque.
      if (tieneChoque) {
        continue;
      }

      // Probar la siguiente asignatura.
      explorar(indiceRamo + 1, [
        ...seleccionadas,
        seccion,
      ]);
    }
  }

  explorar(0, []);

  // Recomendar primero los horarios
  // que mejor cumplen las preferencias.
  return resultados
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limiteResultados));
}
