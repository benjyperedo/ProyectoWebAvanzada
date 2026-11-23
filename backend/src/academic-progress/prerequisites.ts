
/**
 * Prerrequisitos de Ingeniería Civil Informática PUCV.
 * Plan DRA 61/2020, modificado en 2021.
 *
 * Relaciones proporcionadas por el estudiante.
 * Pendientes de validación institucional.
 *
 * Cada asignatura requiere aprobar TODOS
 * sus prerrequisitos registrados.
 */

export const PREREQUISITOS: Record<string, string[]> = {
  'fundamentos-de-programacion': [
    'fundamentos-de-algoritmos',
  ],

  'fisica-para-ingenieria': [
    'introduccion-a-la-matematicas-para-ingenieria',
  ],

  'calculo-diferencial-e-integral': [
    'introduccion-a-la-matematicas-para-ingenieria',
  ],

  'algebra-lineal': [
    'introduccion-a-la-matematicas-para-ingenieria',
  ],

  'analisis-inteligente-de-datos': [
    'calculo-diferencial-e-integral',
  ],

  'calculo-en-varias-variables': [
    'calculo-diferencial-e-integral',
  ],

  'estructura-de-datos': [
    'fundamentos-de-programacion',
  ],

  'metodos-numericos': [
    'fundamentos-de-programacion',
  ],

  'base-de-datos': [
    'fundamentos-de-programacion',
  ],

  'hardware-y-sistemas-operativos': [
    'fundamentos-de-programacion',
  ],

  'fisica-electromagnetismo': [
    'fisica-para-ingenieria',
  ],

  'fisica-moderna': [
    'fisica-para-ingenieria',
  ],

  'programacion-avanzada': [
    'estructura-de-datos',
  ],

  'inteligencia-artificial': [
    'analisis-y-diseno-de-algoritmos',
  ],

  'automatas-y-compiladores': [
    'programacion-avanzada',
  ],

  'estadistica-computacional': [
    'calculo-en-varias-variables',
  ],

  'modelamiento-de-software': [
    'base-de-datos',
  ],

  'taller-de-base-de-datos': [
    'base-de-datos',
  ],

  'redes-de-computadores': [
    'automatas-y-compiladores',
  ],

  'robotica-y-sistemas-autonomos': [
    'redes-de-computadores',
  ],

  'computacion-paralela-y-distribuida': [
    'redes-de-computadores',
  ],

  'ciberseguridad': [
    'redes-de-computadores',
  ],

  'ingenieria-de-software': [
    'modelamiento-de-software',
  ],

  'ingenieria-web-y-movil': [
    'modelamiento-de-software',
  ],

  'economia-y-finanzas': [
    'administracion-de-empresas',
  ],

  'ingenieria-de-requerimientos': [
    'ingenieria-web-y-movil',
  ],

  'experiencia-del-usuario': [
    'ingenieria-de-requerimientos',
  ],

  'taller-ingenieria-de-software': [
    'ingenieria-de-software',
  ],

  'taller-de-formulacion-de-proyectos-informaticos': [
    'administracion-de-proyectos-informaticos',
  ],

  'seminario-de-titulo': [
    'economia-y-finanzas',
    'ingenieria-de-requerimientos',
    'taller-de-base-de-datos',
    'ciberseguridad',
    'administracion-de-proyectos-informaticos',
    'taller-ingenieria-de-software',
    'tecnologias-emergentes',
    'experiencia-del-usuario',
    'negocios-innovacion-y-emprendimiento',
    'optimizacion',
    'estadistica-computacional',
    'redes-de-computadores',
    'inteligencia-artificial',
  ],

  'proyecto-de-titulo': [
    'seminario-de-titulo',
  ],

  'ingles-2': ['ingles-1'],
  'ingles-3': ['ingles-2'],
  'ingles-4': ['ingles-3'],
};
