import type { PeriodoHorario } from './schedule-generator.service.js';

// Período académico con el que trabaja hoy la aplicación.
// Para cambiarlo (por ejemplo a 2027-2), se modifica solo aquí.
export const PERIODO_ACTUAL: PeriodoHorario = {
  year: 2027,
  semester: 1,
  isDemo: true,
};