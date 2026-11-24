import {
  buscarHorarios,
  evaluarHorario,
  generarHorarios,
  hayChoque,
  type PreferenciasHorario,
  type SeccionHorario,
} from './schedule-generator.algorithm.js';

const PREFS: PreferenciasHorario = {
  preferredShift: 'ANY',
  preferredFreeDay: null,
  latestEndTime: '18:00',
};

function seccion(
  id: number,
  courseId: number,
  ...bloques: [SeccionHorario['meetings'][0]['day'], string, string][]
): SeccionHorario {
  return {
    id,
    courseId,
    code: `S${id}`,
    meetings: bloques.map(([day, startTime, endTime]) => ({
      day,
      startTime,
      endTime,
    })),
  };
}

describe('hayChoque', () => {
  it('detecta superposición y respeta bloques contiguos', () => {
    expect(
      hayChoque(
        { day: 'MONDAY', startTime: '08:00', endTime: '09:30' },
        { day: 'MONDAY', startTime: '09:00', endTime: '10:00' },
      ),
    ).toBe(true);
    expect(
      hayChoque(
        { day: 'MONDAY', startTime: '08:00', endTime: '09:00' },
        { day: 'MONDAY', startTime: '09:00', endTime: '10:00' },
      ),
    ).toBe(false);
  });
});

describe('evaluarHorario', () => {
  it('penaliza las ventanas entre clases', () => {
    const sinVentana = evaluarHorario(
      [seccion(1, 1, ['MONDAY', '08:00', '09:00']), seccion(2, 2, ['MONDAY', '09:00', '10:00'])],
      PREFS,
    );
    const conVentana = evaluarHorario(
      [seccion(1, 1, ['MONDAY', '08:00', '09:00']), seccion(2, 2, ['MONDAY', '12:00', '13:00'])],
      PREFS,
    );

    expect(sinVentana.gapMinutes).toBe(0);
    expect(conVentana.gapMinutes).toBe(180);
    expect(conVentana.score).toBeLessThan(sinVentana.score);
  });

  it('penaliza ir más días a la universidad', () => {
    const unDia = evaluarHorario(
      [seccion(1, 1, ['MONDAY', '08:00', '09:00']), seccion(2, 2, ['MONDAY', '09:00', '10:00'])],
      PREFS,
    );
    const dosDias = evaluarHorario(
      [seccion(1, 1, ['MONDAY', '08:00', '09:00']), seccion(2, 2, ['TUESDAY', '08:00', '09:00'])],
      PREFS,
    );

    expect(unDia.daysOnCampus).toBe(1);
    expect(dosDias.daysOnCampus).toBe(2);
    expect(dosDias.score).toBeLessThan(unDia.score);
  });

  it('el desglose suma exactamente el puntaje total', () => {
    const r = evaluarHorario(
      [seccion(1, 1, ['MONDAY', '08:00', '19:00'])],
      { preferredShift: 'MORNING', preferredFreeDay: 'FRIDAY', latestEndTime: '18:00' },
    );

    expect(r.breakdown.reduce((t, d) => t + d.points, 0)).toBe(r.score);
    expect(r.breakdown.find((d) => d.key === 'freeDay')?.points).toBe(20);
    expect(r.breakdown.find((d) => d.key === 'lateEnd')?.points).toBe(-10);
  });
});

describe('buscarHorarios', () => {
  it('devuelve vacío si algún ramo no tiene secciones', () => {
    expect(generarHorarios([[seccion(1, 1, ['MONDAY', '08:00', '09:00'])], []], PREFS)).toEqual([]);
  });

  it('descarta combinaciones con choque', () => {
    const r = generarHorarios(
      [
        [seccion(1, 1, ['MONDAY', '08:00', '10:00'])],
        [seccion(2, 2, ['MONDAY', '09:00', '11:00']), seccion(3, 2, ['TUESDAY', '09:00', '11:00'])],
      ],
      PREFS,
    );

    expect(r).toHaveLength(1);
    expect(r[0].sections.map((s) => s.id)).toEqual([1, 3]);
  });

  it('mantiene las secciones en el orden original de los ramos', () => {
    const r = generarHorarios(
      [
        [seccion(1, 1, ['MONDAY', '08:00', '09:00']), seccion(2, 1, ['MONDAY', '10:00', '11:00'])],
        [seccion(3, 2, ['TUESDAY', '08:00', '09:00'])],
      ],
      PREFS,
    );

    expect(r[0].sections.map((s) => s.courseId)).toEqual([1, 2]);
  });

  it('los empates quedan en un orden estable, sin importar el orden de entrada', () => {
    const a = seccion(1, 1, ['MONDAY', '08:00', '09:00']);
    const b = seccion(2, 1, ['TUESDAY', '08:00', '09:00']);
    const c = seccion(3, 2, ['WEDNESDAY', '08:00', '09:00']);

    const ids = (r: ReturnType<typeof generarHorarios>) =>
      r.map((h) => h.sections.map((s) => s.id));

    expect(ids(generarHorarios([[a, b], [c]], PREFS))).toEqual(
      ids(generarHorarios([[b, a], [c]], PREFS)),
    );
  });

  it('respeta el límite de resultados quedándose con los mejores', () => {
    const opciones = [
      [1, 2, 3, 4].map((i) => seccion(i, 1, ['MONDAY', `0${i + 7}:00`, `0${i + 8}:00`])),
    ];

    const r = generarHorarios(opciones, PREFS, 2);

    expect(r).toHaveLength(2);
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
  });

  it('no se congela con un caso grande: se detiene en el tope y lo avisa', () => {
    // 8 ramos x 8 secciones en días distintos: 8^8 = 16,7 millones de combinaciones
    const dias = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
    const opciones = Array.from({ length: 8 }, (_, ramo) =>
      Array.from({ length: 8 }, (_, s) =>
        seccion(ramo * 10 + s, ramo, [dias[s % 5], `${8 + ramo}:00`.padStart(5, '0'), `${9 + ramo}:00`.padStart(5, '0')]),
      ),
    );

    const inicio = Date.now();
    const r = buscarHorarios(opciones, PREFS, 10, 50_000);

    expect(Date.now() - inicio).toBeLessThan(3000);
    expect(r.truncated).toBe(true);
    expect(r.recommendations.length).toBeLessThanOrEqual(10);
  });
});