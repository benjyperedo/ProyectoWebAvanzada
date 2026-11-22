
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

import {
  AcademicProgressEntry,
  AcademicProgressResponse,
  Course,
  CourseFilters,
  CourseResult,
  IngestionResult,
  IngestionStatus,
  SchedulePreferences,
} from './model';

/** Una ejecución de la ingesta tal como la guarda la base de datos. */
export interface IngestionRun {
  id: number;
  status: IngestionStatus;
  startedAt: string;
  durationMs: number | null;
  fromCache: boolean;
  candidates: number | null;
  validCount: number | null;
  rejectedCount: number | null;
  duplicateCount: number | null;
  coverage: number | null;
  validRatio: number | null;
  createdCount: number | null;
  updatedCount: number | null;
  deactivatedCount: number | null;
  errorCode: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ==========================================
  // ASIGNATURAS
  // ==========================================

  /** Obtener asignaturas con filtros opcionales. */
  getCourses(filters: CourseFilters = {}): Observable<Course[]> {
    let params = new HttpParams();

    if (filters.semester !== undefined) {
      params = params.set('semester', filters.semester);
    }

    if (filters.category) {
      params = params.set('category', filters.category);
    }

    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }

    return this.http.get<Course[]>(
      `${this.baseUrl}/courses`,
      { params },
    );
  }

  // ==========================================
  // PROGRESO ACADÉMICO DEL ESTUDIANTE
  // ==========================================

  /** Obtener progreso, prerrequisitos y disponibilidad. */
  getAcademicProgress(): Observable<AcademicProgressResponse> {
    return this.http.get<AcademicProgressResponse>(
      `${this.baseUrl}/academic-progress`,
    );
  }

  /** Marcar una asignatura como aprobada o reprobada. */
  updateAcademicProgress(
    courseId: number,
    result: CourseResult,
  ): Observable<AcademicProgressEntry> {
    return this.http.put<AcademicProgressEntry>(
      `${this.baseUrl}/academic-progress/${courseId}`,
      { result },
    );
  }

  /** Eliminar un resultado y dejar la asignatura pendiente. */
  clearAcademicProgress(
    courseId: number,
  ): Observable<{ courseId: number; cleared: boolean }> {
    return this.http.delete<{
      courseId: number;
      cleared: boolean;
    }>(
      `${this.baseUrl}/academic-progress/${courseId}`,
    );
  }


  // ==========================================
  // PREFERENCIAS DEL HORARIO INTELIGENTE
  // ==========================================

  /** Obtener las preferencias del estudiante autenticado. */
  getSchedulePreferences(): Observable<SchedulePreferences> {
    return this.http.get<SchedulePreferences>(
      `${this.baseUrl}/schedule-preferences`,
    );
  }

  /** Guardar o actualizar las preferencias del estudiante. */
  saveSchedulePreferences(
    preferences: SchedulePreferences,
  ): Observable<SchedulePreferences> {
    return this.http.put<SchedulePreferences>(
      `${this.baseUrl}/schedule-preferences`,
      preferences,
    );
  }

  // ==========================================
  // INGESTA DE MALLA CURRICULAR (ADMIN)
  // ==========================================

  /** Solo ADMIN: dispara la descarga y procesamiento de la malla. */
  runCurriculumIngestion(): Observable<IngestionResult> {
    return this.http.post<IngestionResult>(
      `${this.baseUrl}/ingestion/curriculum`,
      {},
    );
  }

  /** Solo ADMIN: historial de ejecuciones con sus métricas. */
  getIngestionRuns(limit = 10): Observable<IngestionRun[]> {
    const params = new HttpParams().set('limit', limit);

    return this.http.get<IngestionRun[]>(
      `${this.baseUrl}/ingestion/runs`,
      { params },
    );
  }
}
