
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonButton,
} from '@ionic/angular';

import { ApiService } from '../core/api.service';
import { describeError } from '../core/auth.interceptor';

import {
  Course,
  GeneratedScheduleRecommendation,
  GeneratedScheduleResponse,
  GeneratorWeekday,
  PreferredShift,
  SavedScheduleResponse,
  SchedulePreferences,
  Weekday,
} from '../core/model';

// Bloque preparado para mostrarse en el calendario.
interface BloqueCalendario {
  id: string;
  courseId: number;
  nombreAsignatura: string;
  seccion: string;
  inicio: string;
  termino: string;
  posicion: number;
  altura: number;
  color: number;
}

// Rango de horas que muestra el calendario de un horario.
interface RangoCalendario {
  inicio: number; // minuto en que empieza la grilla
  alto: number; // alto total en píxeles
  horas: { etiqueta: string; posicion: number }[];
}

@Component({
  selector: 'app-horarios',
  templateUrl: 'horarios.page.html',
  styleUrls: ['horarios.page.scss'],
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonButton,
  ],
})
export class HorariosPage {
  private readonly api = inject(ApiService);

  // ==========================================
  // PREFERENCIAS DEL ESTUDIANTE
  // ==========================================

  readonly preferencias = signal<SchedulePreferences>({
    preferredShift: 'ANY',
    preferredFreeDay: null,
    latestEndTime: '18:00',
    maxCourses: 5,
  });

  readonly preferenciasSinGuardar = signal(false);

  readonly cargandoPreferencias = signal(false);
  readonly guardandoPreferencias = signal(false);

  readonly mensajePreferencias = signal('');
  readonly errorPreferencias = signal('');

  // ==========================================
  // ASIGNATURAS ELEGIBLES
  // ==========================================

  readonly cursosElegibles = signal<Course[]>([]);

  readonly cargandoCursos = signal(false);
  readonly errorCursos = signal('');

  readonly cursosSeleccionados = signal<number[]>([]);
  readonly errorSeleccion = signal('');

  // ==========================================
  // GENERADOR DE HORARIOS INTELIGENTES
  // ==========================================

  readonly generandoHorarios = signal(false);

  readonly horariosGenerados =
    signal<GeneratedScheduleResponse | null>(null);

  readonly errorGeneracion = signal('');

  // ==========================================
  // HORARIO GUARDADO EN POSTGRESQL
  // ==========================================

  // Horario persistido del estudiante.
  readonly horarioGuardado =
    signal<SavedScheduleResponse | null>(null);

  // Estados de carga y guardado.
  readonly cargandoHorarioGuardado = signal(false);
  readonly guardandoHorario = signal(false);
  readonly borrandoHorario = signal(false);

  // Mensajes del guardado.
  readonly mensajeHorarioGuardado = signal('');
  readonly errorHorarioGuardado = signal('');

  // ==========================================
  // CALENDARIO SEMANAL
  // ==========================================

  readonly alternativaActiva = signal(0);

  readonly recomendacionActiva = computed(() => {
    const resultado = this.horariosGenerados();

    if (!resultado) {
      return null;
    }

    return (
      resultado.recommendations[this.alternativaActiva()] ??
      null
    );
  });

  // Preparar el horario guardado para reutilizar
  // los cálculos del calendario semanal.
  readonly recomendacionGuardada =
    computed<GeneratedScheduleRecommendation | null>(() => {
      const horario = this.horarioGuardado();

      if (!horario) {
        return null;
      }

      return {
        score: 0,
        sections: horario.sections.map(seccion => ({
          id: seccion.id,
          courseId: seccion.courseId,
          code: seccion.code,
          meetings: seccion.meetings.map(bloque => ({
            day: bloque.day,
            startTime: bloque.startTime,
            endTime: bloque.endTime,
          })),
        })),
      };
    });

  readonly diasCalendario: {
    codigo: GeneratorWeekday;
    nombre: string;
  }[] = [
    { codigo: 'MONDAY', nombre: 'Lunes' },
    { codigo: 'TUESDAY', nombre: 'Martes' },
    { codigo: 'WEDNESDAY', nombre: 'Miércoles' },
    { codigo: 'THURSDAY', nombre: 'Jueves' },
    { codigo: 'FRIDAY', nombre: 'Viernes' },
  ];

  // Rango mínimo del calendario: de 08:00 a 21:00.
  private readonly minutoInicioBase = 8 * 60;
  private readonly minutoFinBase = 21 * 60;
  private readonly pixelesPorHora = 52;

  // Se guarda el último rango calculado para no rehacerlo en cada ciclo.
  private rangoEnCache: { clave: string; rango: RangoCalendario } | null =
    null;

  // El calendario crece solo si hay clases antes de las 8 o después de las 21.
  rangoCalendario(
    recomendacion: GeneratedScheduleRecommendation,
  ): RangoCalendario {
    let inicio = this.minutoInicioBase;
    let fin = this.minutoFinBase;

    for (const seccion of recomendacion.sections) {
      for (const bloque of seccion.meetings) {
        inicio = Math.min(
          inicio,
          Math.floor(this.convertirAMinutos(bloque.startTime) / 60) * 60,
        );
        fin = Math.max(
          fin,
          Math.ceil(this.convertirAMinutos(bloque.endTime) / 60) * 60,
        );
      }
    }

    const clave = `${inicio}-${fin}`;

    if (this.rangoEnCache?.clave === clave) {
      return this.rangoEnCache.rango;
    }

    const cantidadHoras = (fin - inicio) / 60;

    const rango: RangoCalendario = {
      inicio,
      alto: cantidadHoras * this.pixelesPorHora,
      horas: Array.from({ length: cantidadHoras + 1 }, (_, indice) => ({
        etiqueta: `${String(inicio / 60 + indice).padStart(2, '0')}:00`,
        posicion: indice * this.pixelesPorHora,
      })),
    };

    this.rangoEnCache = { clave, rango };

    return rango;
  }

  // Evita mostrar respuestas de generaciones antiguas.
  private versionHorarios = 0;

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  constructor() {
    this.cargarPreferencias();
    this.cargarCursosElegibles();
    this.cargarHorarioGuardado();
  }

  // ==========================================
  // INVALIDAR RECOMENDACIONES ANTERIORES
  // ==========================================

  private invalidarHorarios(): void {
    this.versionHorarios++;

    this.horariosGenerados.set(null);
    this.alternativaActiva.set(0);

    this.errorGeneracion.set('');
    this.mensajeHorarioGuardado.set('');

    // No eliminamos horarioGuardado:
    // sigue almacenado en PostgreSQL.
  }

  // ==========================================
  // CARGAR PREFERENCIAS
  // ==========================================

  cargarPreferencias(): void {
    this.cargandoPreferencias.set(true);
    this.errorPreferencias.set('');

    this.api.getSchedulePreferences().subscribe({
      next: (respuesta) => {
        this.preferencias.set(respuesta);
        this.preferenciasSinGuardar.set(false);
        this.cargandoPreferencias.set(false);
      },
      error: (err: unknown) => {
        this.errorPreferencias.set(describeError(err));
        this.cargandoPreferencias.set(false);
      },
    });
  }

  // ==========================================
  // MODIFICAR PREFERENCIAS
  // ==========================================

  cambiarJornada(jornada: PreferredShift): void {
    this.preferencias.update(actual => ({
      ...actual,
      preferredShift: jornada,
    }));

    this.preferenciasSinGuardar.set(true);
    this.mensajePreferencias.set('');
    this.invalidarHorarios();
  }

  cambiarDiaLibre(dia: Weekday | null): void {
    this.preferencias.update(actual => ({
      ...actual,
      preferredFreeDay: dia,
    }));

    this.preferenciasSinGuardar.set(true);
    this.mensajePreferencias.set('');
    this.invalidarHorarios();
  }

  cambiarHoraTermino(
    hora: SchedulePreferences['latestEndTime'],
  ): void {
    this.preferencias.update(actual => ({
      ...actual,
      latestEndTime: hora,
    }));

    this.preferenciasSinGuardar.set(true);
    this.mensajePreferencias.set('');
    this.invalidarHorarios();
  }

  cambiarMaxCursos(cantidad: number): void {
    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1 ||
      cantidad > 8
    ) {
      return;
    }

    this.preferencias.update(actual => ({
      ...actual,
      maxCourses: cantidad,
    }));

    this.cursosSeleccionados.update(
      seleccionados => seleccionados.slice(0, cantidad),
    );

    this.preferenciasSinGuardar.set(true);
    this.mensajePreferencias.set('');
    this.errorSeleccion.set('');

    this.invalidarHorarios();
  }

  // ==========================================
  // GUARDAR PREFERENCIAS
  // ==========================================

  guardarPreferencias(): void {
    if (
      this.cargandoPreferencias() ||
      this.guardandoPreferencias()
    ) {
      return;
    }

    this.guardandoPreferencias.set(true);
    this.errorPreferencias.set('');
    this.mensajePreferencias.set('');

    this.api.saveSchedulePreferences(
      this.preferencias(),
    ).subscribe({
      next: (respuesta) => {
        this.preferencias.set(respuesta);
        this.preferenciasSinGuardar.set(false);
        this.guardandoPreferencias.set(false);

        this.invalidarHorarios();

        this.mensajePreferencias.set(
          'Preferencias guardadas correctamente.',
        );
      },
      error: (err: unknown) => {
        this.errorPreferencias.set(describeError(err));
        this.guardandoPreferencias.set(false);
      },
    });
  }

  // ==========================================
  // CONSULTAR ASIGNATURAS ELEGIBLES
  // ==========================================

  cargarCursosElegibles(): void {
    this.cargandoCursos.set(true);
    this.errorCursos.set('');

    forkJoin({
      cursos: this.api.getCourses(),
      estado: this.api.getAcademicProgress(),
    }).subscribe({
      next: ({ cursos, estado }) => {
        const resultados = new Map(
          estado.progress.map(p => [p.courseId, p.result]),
        );

        const habilitados = new Set(
          estado.eligibility
            .filter(e => e.status === 'AVAILABLE')
            .map(e => e.courseId),
        );

        const elegibles = cursos.filter(curso =>
          resultados.get(curso.id) !== 'APPROVED' &&
          habilitados.has(curso.id),
        );

        this.cursosElegibles.set(elegibles);

        const idsElegibles = new Set(
          elegibles.map(curso => curso.id),
        );

        this.cursosSeleccionados.update(
          seleccionados =>
            seleccionados.filter(id => idsElegibles.has(id)),
        );

        this.invalidarHorarios();
        this.cargandoCursos.set(false);
      },
      error: (err: unknown) => {
        this.cursosElegibles.set([]);
        this.errorCursos.set(describeError(err));

        this.invalidarHorarios();
        this.cargandoCursos.set(false);
      },
    });
  }

  // ==========================================
  // SELECCIÓN DE ASIGNATURAS
  // ==========================================

  estaSeleccionado(courseId: number): boolean {
    return this.cursosSeleccionados().includes(courseId);
  }

  alternarCurso(courseId: number): void {
    if (
      this.generandoHorarios() ||
      this.guardandoHorario()
    ) {
      return;
    }

    this.errorSeleccion.set('');

    const esElegible = this.cursosElegibles().some(
      curso => curso.id === courseId,
    );

    if (!esElegible) {
      return;
    }

    const seleccionados = this.cursosSeleccionados();

    if (seleccionados.includes(courseId)) {
      this.cursosSeleccionados.set(
        seleccionados.filter(id => id !== courseId),
      );

      this.invalidarHorarios();
      return;
    }

    if (
      seleccionados.length >=
      this.preferencias().maxCourses
    ) {
      this.errorSeleccion.set(
        `Puedes seleccionar como máximo ${this.preferencias().maxCourses} asignaturas.`,
      );
      return;
    }

    this.cursosSeleccionados.set([
      ...seleccionados,
      courseId,
    ]);

    this.invalidarHorarios();
  }

  // ==========================================
  // GENERAR HORARIOS INTELIGENTES
  // ==========================================

  generarHorarios(): void {
    if (
      this.generandoHorarios() ||
      this.guardandoHorario() ||
      this.cargandoPreferencias() ||
      this.guardandoPreferencias() ||
      this.cargandoCursos()
    ) {
      return;
    }

    this.errorGeneracion.set('');
    this.horariosGenerados.set(null);
    this.alternativaActiva.set(0);

    const ids = [...this.cursosSeleccionados()];

    if (ids.length === 0) {
      this.errorGeneracion.set(
        'Selecciona al menos una asignatura para generar tu horario.',
      );
      return;
    }

    if (ids.length > this.preferencias().maxCourses) {
      this.errorGeneracion.set(
        'La cantidad de asignaturas supera el máximo permitido.',
      );
      return;
    }

    this.generandoHorarios.set(true);

    const versionSolicitud = this.versionHorarios;

    const preferenciasEnviadas = this.preferencias();

    this.api.generateSchedule(ids, preferenciasEnviadas).subscribe({
      next: (respuesta) => {
        const mismaSeleccion =
          ids.length === this.cursosSeleccionados().length &&
          ids.every(
            (id, indice) =>
              id === this.cursosSeleccionados()[indice],
          );

        if (
          versionSolicitud === this.versionHorarios &&
          mismaSeleccion &&
          this.preferencias() === preferenciasEnviadas
        ) {
          this.horariosGenerados.set(respuesta);
          this.alternativaActiva.set(0);
        }

        this.generandoHorarios.set(false);
      },
      error: (err: unknown) => {
        if (versionSolicitud === this.versionHorarios) {
          this.errorGeneracion.set(describeError(err));
        }

        this.generandoHorarios.set(false);
      },
    });
  }

  // ==========================================
  // NAVEGAR ENTRE ALTERNATIVAS
  // ==========================================

  cambiarAlternativa(indice: number): void {
    const resultado = this.horariosGenerados();

    if (
      !resultado ||
      !Number.isInteger(indice) ||
      indice < 0 ||
      indice >= resultado.recommendations.length
    ) {
      return;
    }

    this.alternativaActiva.set(indice);

    this.mensajeHorarioGuardado.set('');
    this.errorHorarioGuardado.set('');
  }

  // ==========================================
  // RECUPERAR EL HORARIO GUARDADO
  // ==========================================

  cargarHorarioGuardado(): void {
    if (this.cargandoHorarioGuardado()) {
      return;
    }

    this.cargandoHorarioGuardado.set(true);
    this.errorHorarioGuardado.set('');

    this.api.getSavedSchedule().subscribe({
      next: (respuesta) => {
        this.horarioGuardado.set(respuesta);
        this.cargandoHorarioGuardado.set(false);
      },
      error: (err: unknown) => {
        this.errorHorarioGuardado.set(describeError(err));
        this.cargandoHorarioGuardado.set(false);
      },
    });
  }

  // ==========================================
  // BORRAR EL HORARIO GUARDADO
  // ==========================================

  borrarHorarioGuardado(): void {
    if (
      this.borrandoHorario() ||
      this.guardandoHorario() ||
      !this.horarioGuardado()
    ) {
      return;
    }

    if (!confirm('¿Seguro que quieres borrar tu horario guardado?')) {
      return;
    }

    this.borrandoHorario.set(true);
    this.mensajeHorarioGuardado.set('');
    this.errorHorarioGuardado.set('');

    this.api.deleteSavedSchedule().subscribe({
      next: () => {
        this.horarioGuardado.set(null);
        this.mensajeHorarioGuardado.set('Horario guardado eliminado.');
        this.borrandoHorario.set(false);
      },
      error: (err: unknown) => {
        this.errorHorarioGuardado.set(describeError(err));
        this.borrandoHorario.set(false);
      },
    });
  }

  // ==========================================
  // GUARDAR LA ALTERNATIVA SELECCIONADA
  // ==========================================

  guardarHorarioElegido(): void {
    if (
      this.guardandoHorario() ||
      this.generandoHorarios()
    ) {
      return;
    }

    this.mensajeHorarioGuardado.set('');
    this.errorHorarioGuardado.set('');

    const resultado = this.horariosGenerados();
    const recomendacion = this.recomendacionActiva();

    if (!resultado || !recomendacion) {
      this.errorHorarioGuardado.set(
        'Primero debes generar y seleccionar un horario.',
      );
      return;
    }

    const sectionIds = recomendacion.sections.map(
      seccion => seccion.id,
    );

    if (sectionIds.length === 0) {
      this.errorHorarioGuardado.set(
        'El horario seleccionado no contiene secciones.',
      );
      return;
    }

    this.guardandoHorario.set(true);

    this.api.saveSchedule(
      sectionIds,
      resultado.period,
    ).subscribe({
      next: (respuesta) => {
        // PostgreSQL ya confirmó el guardado.
        this.horarioGuardado.set(respuesta);
        this.guardandoHorario.set(false);

        this.mensajeHorarioGuardado.set(
          '¡Horario guardado correctamente en tu cuenta!',
        );
      },
      error: (err: unknown) => {
        this.errorHorarioGuardado.set(
          describeError(err),
        );

        this.guardandoHorario.set(false);
      },
    });
  }

  // ==========================================
  // COMPROBAR SI LA ALTERNATIVA ESTÁ GUARDADA
  // ==========================================

  estaAlternativaGuardada(): boolean {
    const resultado = this.horariosGenerados();
    const recomendacion = this.recomendacionActiva();
    const guardado = this.horarioGuardado();

    if (!resultado || !recomendacion || !guardado) {
      return false;
    }

    const mismoPeriodo =
      resultado.period.year === guardado.period.year &&
      resultado.period.semester === guardado.period.semester &&
      resultado.period.isDemo === guardado.period.isDemo;

    if (!mismoPeriodo) {
      return false;
    }

    const seccionesGuardadas = new Set(
      guardado.sections.map(seccion => seccion.id),
    );

    return (
      recomendacion.sections.length ===
        guardado.sections.length &&
      recomendacion.sections.every(
        seccion => seccionesGuardadas.has(seccion.id),
      )
    );
  }

  // ==========================================
  // FUNCIONES DEL CALENDARIO SEMANAL
  // ==========================================

  private convertirAMinutos(hora: string): number {
    const [horas, minutos] = hora.split(':').map(Number);

    return horas * 60 + minutos;
  }

  obtenerNombreAsignatura(courseId: number): string {
    // Primero buscar entre los ramos disponibles.
    const curso = this.cursosElegibles().find(
      item => item.id === courseId,
    );

    if (curso) {
      return curso.name;
    }

    // Si ya no está disponible, buscar en el horario
    // que el estudiante tiene guardado.
    const seccionGuardada =
      this.horarioGuardado()?.sections.find(
        item => item.courseId === courseId,
      );

    return (
      seccionGuardada?.courseName ??
      `Asignatura ${courseId}`
    );
  }

  obtenerBloquesPorDia(
    recomendacion: GeneratedScheduleRecommendation,
    dia: GeneratorWeekday,
  ): BloqueCalendario[] {
    const minutoInicio = this.rangoCalendario(recomendacion).inicio;
    const bloques: BloqueCalendario[] = [];

    recomendacion.sections.forEach(
      (seccion, indiceColor) => {
        seccion.meetings.forEach(
          (bloque, indiceBloque) => {
            if (bloque.day !== dia) {
              return;
            }

            const inicio = this.convertirAMinutos(
              bloque.startTime,
            );

            const termino = this.convertirAMinutos(
              bloque.endTime,
            );

            const posicion =
              ((inicio - minutoInicio) / 60) *
              this.pixelesPorHora;

            const altura =
              ((termino - inicio) / 60) *
              this.pixelesPorHora;

            bloques.push({
              id: `${seccion.id}-${dia}-${indiceBloque}`,
              courseId: seccion.courseId,
              nombreAsignatura: this.obtenerNombreAsignatura(
                seccion.courseId,
              ),
              seccion: seccion.code,
              inicio: bloque.startTime,
              termino: bloque.endTime,
              posicion,
              altura,
              color: indiceColor % 5,
            });
          },
        );
      },
    );

    return bloques.sort(
      (a, b) => a.posicion - b.posicion,
    );
  }
}
