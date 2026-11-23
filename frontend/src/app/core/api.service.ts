import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

import {
  AcademicProgressEntry,
  AcademicProgressResponse,
  AcademicRequest,
  CalendarEvent,
  Course,
  CourseFilters,
  CourseResult,
  CreateAcademicRequest,
  CreateCalendarEvent,
  GeneratedScheduleResponse,
  IngestionResult,
  IngestionStatus,
  SavedScheduleResponse,
  SchedulePreferences,
  UpdateCalendarEvent,
} from './model';

// ==========================================
// HISTORIAL DE INGESTA
// ==========================================

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

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ==========================================
  // ASIGNATURAS
  // ==========================================

  getCourses(
    filters: CourseFilters = {},
  ): Observable<Course[]> {
    let params = new HttpParams();

    if (filters.semester !== undefined) {
      params = params.set(
        'semester',
        filters.semester,
      );
    }

    if (filters.category) {
      params = params.set(
        'category',
        filters.category,
      );
    }

    if (filters.q?.trim()) {
      params = params.set(
        'q',
        filters.q.trim(),
      );
    }

    return this.http.get<Course[]>(
      `${this.baseUrl}/courses`,
      { params },
    );
  }

  // ==========================================
  // PROGRESO ACADÉMICO
  // ==========================================

  getAcademicProgress(): Observable<AcademicProgressResponse> {
    return this.http.get<AcademicProgressResponse>(
      `${this.baseUrl}/academic-progress`,
    );
  }

  updateAcademicProgress(
    courseId: number,
    result: CourseResult,
  ): Observable<AcademicProgressEntry> {
    return this.http.put<AcademicProgressEntry>(
      `${this.baseUrl}/academic-progress/${courseId}`,
      { result },
    );
  }

  clearAcademicProgress(
    courseId: number,
  ): Observable<{
    courseId: number;
    cleared: boolean;
  }> {
    return this.http.delete<{
      courseId: number;
      cleared: boolean;
    }>(
      `${this.baseUrl}/academic-progress/${courseId}`,
    );
  }

  // ==========================================
  // PREFERENCIAS DEL GENERADOR DE HORARIOS
  // ==========================================

  getSchedulePreferences(): Observable<SchedulePreferences> {
    return this.http.get<SchedulePreferences>(
      `${this.baseUrl}/schedule-preferences`,
    );
  }

  saveSchedulePreferences(
    preferences: SchedulePreferences,
  ): Observable<SchedulePreferences> {
    return this.http.put<SchedulePreferences>(
      `${this.baseUrl}/schedule-preferences`,
      preferences,
    );
  }

  // ==========================================
  // GENERADOR DE HORARIOS INTELIGENTES
  // ==========================================

  generateSchedule(
    courseIds: number[],
  ): Observable<GeneratedScheduleResponse> {
    return this.http.post<GeneratedScheduleResponse>(
      `${this.baseUrl}/schedule-generator/generate`,
      { courseIds },
    );
  }

  // ==========================================
  // HORARIOS GUARDADOS
  // ==========================================

  saveSchedule(
    sectionIds: number[],
    period: GeneratedScheduleResponse['period'],
  ): Observable<SavedScheduleResponse> {
    return this.http.post<SavedScheduleResponse>(
      `${this.baseUrl}/schedule-generator/save`,
      {
        sectionIds,
        period,
      },
    );
  }

  getSavedSchedule(): Observable<SavedScheduleResponse | null> {
    return this.http.get<SavedScheduleResponse | null>(
      `${this.baseUrl}/schedule-generator/saved`,
    );
  }

  // ==========================================
  // CALENDARIO ACADÉMICO Y PERSONAL
  // ==========================================

  /**
   * Consultar los eventos del estudiante
   * para un mes y año específicos.
   *
   * Ejemplo:
   * GET /calendar-events?year=2026&month=11
   */
  getCalendarEvents(
    year: number,
    month: number,
  ): Observable<CalendarEvent[]> {
    const params = new HttpParams()
      .set('year', year)
      .set('month', month);

    return this.http.get<CalendarEvent[]>(
      `${this.baseUrl}/calendar-events`,
      { params },
    );
  }

  /**
   * Crear un evento en el calendario.
   *
   * El backend obtiene el usuario
   * desde su sesión autenticada.
   */
  createCalendarEvent(
    evento: CreateCalendarEvent,
  ): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(
      `${this.baseUrl}/calendar-events`,
      evento,
    );
  }

  /**
   * Editar un evento existente.
   *
   * Solo se envían los campos
   * que el estudiante desea modificar.
   */
  updateCalendarEvent(
    eventId: number,
    cambios: UpdateCalendarEvent,
  ): Observable<CalendarEvent> {
    return this.http.patch<CalendarEvent>(
      `${this.baseUrl}/calendar-events/${eventId}`,
      cambios,
    );
  }

  /**
   * Eliminar un evento.
   *
   * El backend comprueba que pertenezca
   * al estudiante autenticado.
   */
  deleteCalendarEvent(
    eventId: number,
  ): Observable<{
    deleted: boolean;
    id: number;
  }> {
    return this.http.delete<{
      deleted: boolean;
      id: number;
    }>(
      `${this.baseUrl}/calendar-events/${eventId}`,
    );
  }

  // ==========================================
  // TRÁMITES ACADÉMICOS DE LISTOCO
  // ==========================================

  /**
   * Consultar todas las solicitudes académicas
   * del estudiante autenticado.
   *
   * GET /academic-requests
   *
   * Estos datos se mostrarán en "Mis trámites".
   */
  getAcademicRequests(): Observable<AcademicRequest[]> {
    return this.http.get<AcademicRequest[]>(
      `${this.baseUrl}/academic-requests`,
    );
  }

  /**
   * Crear una solicitud académica.
   *
   * POST /academic-requests
   *
   * Utilizamos FormData porque la justificación
   * de inasistencia puede incluir un archivo.
   *
   * Los otros tres tipos de solicitudes
   * también utilizan este método.
   */
  createAcademicRequest(
    datos: CreateAcademicRequest,
  ): Observable<AcademicRequest> {

    const formulario = new FormData();

    // Tipo de trámite.
    formulario.append(
      'type',
      datos.type,
    );

    // Correo del destinatario.
    formulario.append(
      'recipientEmail',
      datos.recipientEmail.trim(),
    );

    // Explicación o justificación.
    formulario.append(
      'description',
      datos.description.trim(),
    );

    // Asignatura, cuando corresponda.
    if (datos.courseName?.trim()) {
      formulario.append(
        'courseName',
        datos.courseName.trim(),
      );
    }

    // Fecha de inasistencia, cuando corresponda.
    if (datos.absenceDate) {
      formulario.append(
        'absenceDate',
        datos.absenceDate,
      );
    }

    // Asunto para otras solicitudes.
    if (datos.subject?.trim()) {
      formulario.append(
        'subject',
        datos.subject.trim(),
      );
    }

    // Archivo justificativo.
    // Solo para inasistencias.
    if (
      datos.type === 'ABSENCE_JUSTIFICATION' &&
      datos.attachment
    ) {
      formulario.append(
        'attachment',
        datos.attachment,
        datos.attachment.name,
      );
    }

    // No establecer manualmente Content-Type:
    // el navegador agrega multipart/form-data
    // con su boundary correspondiente.
    return this.http.post<AcademicRequest>(
      `${this.baseUrl}/academic-requests`,
      formulario,
    );
  }

  /**
   * Consultar el detalle de un trámite.
   *
   * GET /academic-requests/:id
   */
  getAcademicRequest(
    requestId: number,
  ): Observable<AcademicRequest> {
    return this.http.get<AcademicRequest>(
      `${this.baseUrl}/academic-requests/${requestId}`,
    );
  }

  /**
   * Descargar el justificativo asociado
   * a una solicitud del estudiante.
   *
   * GET /academic-requests/:id/attachment
   *
   * El servidor comprueba que el archivo
   * pertenezca al usuario autenticado.
   *
   * La respuesta es un Blob para permitir
   * su descarga desde Angular.
   */
  downloadAcademicRequestAttachment(
    requestId: number,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/academic-requests/${requestId}/attachment`,
      {
        responseType: 'blob',
      },
    );
  }

  // ==========================================
  // INGESTA DE MALLA CURRICULAR (ADMIN)
  // ==========================================

  runCurriculumIngestion(): Observable<IngestionResult> {
    return this.http.post<IngestionResult>(
      `${this.baseUrl}/ingestion/curriculum`,
      {},
    );
  }

  getIngestionRuns(
    limit = 10,
  ): Observable<IngestionRun[]> {
    const params = new HttpParams()
      .set('limit', limit);

    return this.http.get<IngestionRun[]>(
      `${this.baseUrl}/ingestion/runs`,
      { params },
    );
  }
}
