
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ApiService } from '../core/api.service';
import { describeError } from '../core/auth.interceptor';
import {
  AcademicProgressEntry,
  Course,
  CourseEligibility,
  CourseResult,
} from '../core/model';

interface GrupoSemestre {
  semestre: number;
  cursos: Course[];
}

@Component({
  selector: 'app-planificacion',
  templateUrl: 'planificacion.page.html',
  styleUrls: ['planificacion.page.scss'],
  imports: [
    DatePipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonText,
  ],
})
export class PlanificacionPage {
  private readonly api = inject(ApiService);

  // ==========================================
  // ASIGNATURAS Y FILTROS
  // ==========================================

  readonly semestres = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  readonly cursos = signal<Course[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly semestre = signal<number | null>(null);
  readonly busqueda = signal('');

  // ==========================================
  // PROGRESO ACADÉMICO
  // ==========================================

  // Ramos aprobados y reprobados del estudiante
  readonly progreso = signal<AcademicProgressEntry[]>([]);

  // Disponibilidad según los prerrequisitos
  readonly elegibilidad = signal<CourseEligibility[]>([]);

  // Control de carga y guardado
  readonly cargandoProgreso = signal(false);
  readonly guardandoCursoId = signal<number | null>(null);
  readonly errorProgreso = signal('');

  // ==========================================
  // AGRUPACIÓN DE ASIGNATURAS
  // ==========================================

  /** Cursos agrupados por semestre sugerido. */
  readonly grupos = computed<GrupoSemestre[]>(() => {
    const porSemestre = new Map<number, Course[]>();

    for (const curso of this.cursos()) {
      const lista = porSemestre.get(curso.suggestedSemester) ?? [];
      lista.push(curso);
      porSemestre.set(curso.suggestedSemester, lista);
    }

    return [...porSemestre.entries()]
      .sort(([a], [b]) => a - b)
      .map(([semestre, cursos]) => ({ semestre, cursos }));
  });

  // ==========================================
  // PROCEDENCIA DE LOS DATOS
  // ==========================================

  /** Fuente y fecha de la información mostrada. */
  readonly procedencia = computed(() => {
    const conFuente = this.cursos().find((c) => c.source);

    if (!conFuente?.source) {
      return null;
    }

    const fechas = this.cursos()
      .map((c) => c.lastSeenAt)
      .filter((f): f is string => f !== null)
      .sort();

    return {
      fuente: conFuente.source,
      actualizado: fechas.length > 0
        ? fechas[fechas.length - 1]
        : null,
    };
  });

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  constructor() {
    this.cargar();
    this.cargarProgreso();
  }

  // ==========================================
  // FILTROS
  // ==========================================

  cambiarSemestre(valor: unknown) {
    this.semestre.set(typeof valor === 'number' ? valor : null);
    this.cargar();
  }

  buscar(evento: Event) {
    const valor = (
      evento as CustomEvent<{ value?: string | null }>
    ).detail.value;

    this.busqueda.set(valor ?? '');
    this.cargar();
  }

  // ==========================================
  // CONSULTAR ASIGNATURAS
  // ==========================================

  cargar() {
    this.cargando.set(true);
    this.error.set('');

    this.api
      .getCourses({
        semester: this.semestre() ?? undefined,
        q: this.busqueda(),
      })
      .subscribe({
        next: (cursos) => {
          this.cursos.set(cursos);
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          this.cursos.set([]);
          this.error.set(describeError(err));
          this.cargando.set(false);
        },
      });
  }

  // ==========================================
  // CONSULTAR PROGRESO ACADÉMICO
  // ==========================================

  /** Recuperar los resultados y bloqueos del estudiante. */
  cargarProgreso(): void {
    this.cargandoProgreso.set(true);
    this.errorProgreso.set('');

    this.api.getAcademicProgress().subscribe({
      next: (respuesta) => {
        this.progreso.set(respuesta.progress);
        this.elegibilidad.set(respuesta.eligibility);
        this.cargandoProgreso.set(false);
      },
      error: (err: unknown) => {
        this.errorProgreso.set(describeError(err));
        this.cargandoProgreso.set(false);
      },
    });
  }

  /** Obtener el resultado de una asignatura. */
  resultadoDe(courseId: number): CourseResult | null {
    return this.progreso().find(
      (p) => p.courseId === courseId,
    )?.result ?? null;
  }

  /** Obtener la disponibilidad de una asignatura. */
  disponibilidadDe(
    courseId: number,
  ): CourseEligibility | undefined {
    return this.elegibilidad().find(
      (e) => e.courseId === courseId,
    );
  }

  // ==========================================
  // APROBAR O REPROBAR ASIGNATURAS
  // ==========================================

  /** Guardar el resultado de una asignatura. */
  marcarCurso(
    courseId: number,
    resultado: CourseResult,
  ): void {
    if (
      this.cargandoProgreso() ||
      this.guardandoCursoId() !== null
    ) {
      return;
    }

    // Evitar marcar ramos con prerrequisitos pendientes
    if (
      this.disponibilidadDe(courseId)?.status === 'BLOCKED'
    ) {
      this.errorProgreso.set(
        'Esta asignatura tiene prerrequisitos pendientes.',
      );
      return;
    }

    this.guardandoCursoId.set(courseId);
    this.errorProgreso.set('');

    this.api.updateAcademicProgress(
      courseId,
      resultado,
    ).subscribe({
      next: () => {
        this.guardandoCursoId.set(null);
        this.cargarProgreso();
      },
      error: (err: unknown) => {
        this.errorProgreso.set(describeError(err));
        this.guardandoCursoId.set(null);
      },
    });
  }

  // ==========================================
  // QUITAR RESULTADO DE UNA ASIGNATURA
  // ==========================================

  /** Volver una asignatura a su estado pendiente. */
  limpiarCurso(courseId: number): void {
    if (this.guardandoCursoId() !== null) {
      return;
    }

    this.guardandoCursoId.set(courseId);
    this.errorProgreso.set('');

    this.api.clearAcademicProgress(courseId).subscribe({
      next: () => {
        this.guardandoCursoId.set(null);
        this.cargarProgreso();
      },
      error: (err: unknown) => {
        this.errorProgreso.set(describeError(err));
        this.guardandoCursoId.set(null);
      },
    });
  }
}
