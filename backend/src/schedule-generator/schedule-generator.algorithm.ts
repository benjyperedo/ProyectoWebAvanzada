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

// Una línea del desglose: qué sumó o restó y por qué.
export interface DetallePuntaje {
  key: 'freeDay' | 'shift' | 'lateEnd' | 'gaps' | 'days';
  label: string;
  points: number;
}

export interface HorarioRecomendado {
  sections: SeccionHorario[];
  score: number;
  breakdown: DetallePuntaje[];
  daysOnCampus: number;
  gapMinutes: number;
}

export interface ResultadoBusqueda {
  recommendations: HorarioRecomendado[];
  // true si se alcanzó el tope de búsqueda y puede haber mejores horarios sin revisar
  truncated: boolean;
  explored: number;
}

// Pesos del puntaje, en un solo lugar para ajustarlos fácilmente.
export const PESOS = {
  freeDay: 20,
  shiftPerBlock: 3,
  lateEndPerBlock: -10,
  gapPer30Min: -1,
  perDayOnCampus: -4,
} as const;

// Tope de nodos que explora la búsqueda antes de detenerse.
export const LIMITE_NODOS = 200_000;

const DIAS_ORDEN: DiaSemana[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

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

// Calcula el puntaje y explica de dónde sale cada punto.
export function evaluarHorario(
  secciones: SeccionHorario[],
  preferencias: PreferenciasHorario,
): Pick<
  HorarioRecomendado,
  'score' | 'breakdown' | 'daysOnCampus' | 'gapMinutes'
> {
  const bloques = secciones.flatMap((s) => s.meetings);
  const mediodia = convertirAMinutos('12:00');
  const horaLimite = convertirAMinutos(preferencias.latestEndTime);

  // Día preferido libre
  const diaLibre =
    preferencias.preferredFreeDay !== null &&
    bloques.every((b) => b.day !== preferencias.preferredFreeDay)
      ? PESOS.freeDay
      : 0;

  // Jornada preferida y clases que terminan tarde
  let enJornada = 0;
  let tarde = 0;

  for (const bloque of bloques) {
    const inicio = convertirAMinutos(bloque.startTime);
    const termino = convertirAMinutos(bloque.endTime);

    if (
      (preferencias.preferredShift === 'MORNING' && inicio < mediodia) ||
      (preferencias.preferredShift === 'AFTERNOON' && inicio >= mediodia)
    ) {
      enJornada++;
    }

    if (termino > horaLimite) {
      tarde++;
    }
  }

  // Ventanas entre clases y días de asistencia
  let gapMinutes = 0;
  let daysOnCampus = 0;

  for (const dia of DIAS_ORDEN) {
    const delDia = bloques
      .filter((b) => b.day === dia)
      .map((b) => ({
        inicio: convertirAMinutos(b.startTime),
        termino: convertirAMinutos(b.endTime),
      }))
      .sort((a, b) => a.inicio - b.inicio);

    if (delDia.length === 0) {
      continue;
    }

    daysOnCampus++;

    for (let i = 1; i < delDia.length; i++) {
      gapMinutes += Math.max(0, delDia[i].inicio - delDia[i - 1].termino);
    }
  }

  const breakdown: DetallePuntaje[] = [
    { key: 'freeDay', label: 'Día libre preferido', points: diaLibre },
    {
      key: 'shift',
      label: 'Clases en la jornada preferida',
      points: enJornada * PESOS.shiftPerBlock,
    },
    {
      key: 'lateEnd',
      label: 'Clases que terminan tarde',
      points: tarde * PESOS.lateEndPerBlock,
    },
    {
      key: 'gaps',
      label: 'Ventanas entre clases',
      points: Math.floor(gapMinutes / 30) * PESOS.gapPer30Min,
    },
    {
      key: 'days',
      label: 'Días que debes ir a la universidad',
      points: daysOnCampus * PESOS.perDayOnCampus,
    },
  ];

  return {
    score: breakdown.reduce((total, d) => total + d.points, 0),
    breakdown,
    daysOnCampus,
    gapMinutes,
  };
}

// Orden total y estable: mejor puntaje, menos días, menos ventanas
// y, si aún empatan, por los ids de sus secciones.
function compararHorarios(
  a: HorarioRecomendado,
  b: HorarioRecomendado,
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.daysOnCampus !== b.daysOnCampus) return a.daysOnCampus - b.daysOnCampus;
  if (a.gapMinutes !== b.gapMinutes) return a.gapMinutes - b.gapMinutes;

  for (let i = 0; i < a.sections.length; i++) {
    if (a.sections[i].id !== b.sections[i].id) {
      return a.sections[i].id - b.sections[i].id;
    }
  }

  return 0;
}

// Inserta en una lista ya ordenada y la recorta a `limite` elementos.
function insertarTop(
  top: HorarioRecomendado[],
  candidato: HorarioRecomendado,
  limite: number,
): void {
  if (
    top.length === limite &&
    compararHorarios(candidato, top[top.length - 1]) >= 0
  ) {
    return;
  }

  let posicion = top.findIndex((t) => compararHorarios(candidato, t) < 0);

  if (posicion === -1) {
    posicion = top.length;
  }

  top.splice(posicion, 0, candidato);

  if (top.length > limite) {
    top.pop();
  }
}

function tieneConflictoInterno(seccion: SeccionHorario): boolean {
  return seccion.meetings.some((bloque, indice) =>
    seccion.meetings.slice(indice + 1).some((otro) => hayChoque(bloque, otro)),
  );
}

// Busca combinaciones sin choques guardando solo las mejores mientras explora.
export function buscarHorarios(
  opcionesPorRamo: SeccionHorario[][],
  preferencias: PreferenciasHorario,
  limiteResultados = 10,
  limiteNodos = LIMITE_NODOS,
): ResultadoBusqueda {
  const limite = Math.max(0, limiteResultados);

  if (
    limite === 0 ||
    opcionesPorRamo.length === 0 ||
    opcionesPorRamo.some((secciones) => secciones.length === 0)
  ) {
    return { recommendations: [], truncated: false, explored: 0 };
  }

  // Se descartan de entrada las secciones con bloques que chocan entre sí.
  const opciones = opcionesPorRamo.map((secciones) =>
    secciones.filter((s) => !tieneConflictoInterno(s)),
  );

  if (opciones.some((secciones) => secciones.length === 0)) {
    return { recommendations: [], truncated: false, explored: 0 };
  }

  // Se exploran primero los ramos con menos secciones: poda antes.
  const orden = opciones
    .map((_, indice) => indice)
    .sort((a, b) => opciones[a].length - opciones[b].length || a - b);

  const top: HorarioRecomendado[] = [];
  const elegidas: SeccionHorario[] = new Array(opciones.length);
  let explorados = 0;
  let truncado = false;

  function explorar(nivel: number): void {
    if (truncado) return;

    if (nivel === orden.length) {
      // `elegidas` está indexado por el orden original de los ramos.
      const secciones = [...elegidas];

      insertarTop(
        top,
        { sections: secciones, ...evaluarHorario(secciones, preferencias) },
        limite,
      );
      return;
    }

    const indiceRamo = orden[nivel];

    for (const seccion of opciones[indiceRamo]) {
      if (++explorados > limiteNodos) {
        truncado = true;
        return;
      }

      const choca = orden
        .slice(0, nivel)
        .some((previo) =>
          seccion.meetings.some((bloque) =>
            elegidas[previo].meetings.some((otro) => hayChoque(bloque, otro)),
          ),
        );

      if (choca) continue;

      elegidas[indiceRamo] = seccion;
      explorar(nivel + 1);
    }
  }

  explorar(0);

  return { recommendations: top, truncated: truncado, explored: explorados };
}

// Versión simple que solo devuelve la lista de horarios.
export function generarHorarios(
  opcionesPorRamo: SeccionHorario[][],
  preferencias: PreferenciasHorario,
  limiteResultados = 10,
): HorarioRecomendado[] {
  return buscarHorarios(opcionesPorRamo, preferencias, limiteResultados)
    .recommendations;
}