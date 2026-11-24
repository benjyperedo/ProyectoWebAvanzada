
export type Role = 'STUDENT' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  role: Role;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

/** Fuente web de la que viene un dato (por ejemplo, la malla de la PUCV). */
export interface DataSourceInfo {
  key: string;
  name: string;
  url: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  /** La fuente web no publica créditos: puede ser null. */
  credits: number | null;
  suggestedSemester: number;
  category: string | null;
  active: boolean;
  /** Fecha en que la asignatura se vio por última vez en la fuente. */
  lastSeenAt: string | null;
  source: DataSourceInfo | null;
}

export interface CourseFilters {
  semester?: number;
  category?: string;
  q?: string;
}

export type IngestionStatus =
  | 'SUCCESS'
  | 'DEGRADED'
  | 'FAILED';

export interface IngestionProvenance {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  sha256: string;
  contentLength: number;
  resolution: string;
  fromCache: boolean;
  changed: boolean | null;
  extractorVersion: string;
}

/** Métricas de calidad de los datos recuperados. */
export interface IngestionMetrics {
  candidates: number;
  valid: number;
  rejected: number;
  duplicates: number;
  semestersDetected: number;
  semestersExpected: number;
  coverage: number;
  validRatio: number;
}

export interface IngestionResult {
  runId: number;
  status: IngestionStatus;
  provenance: IngestionProvenance;
  metrics: IngestionMetrics;
  persistence: {
    created: number;
    updated: number;
    unchanged: number;
    deactivated: number;
  };
  warnings: string[];
}

/** Respuesta de error de la API; nunca trae trazas internas. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
}


//
// ==========================================
// PROGRESO ACADÉMICO
// ==========================================
//

/** Resultado académico registrado por el estudiante. */
export type CourseResult =
  | 'APPROVED'
  | 'FAILED';

/** Disponibilidad según prerrequisitos registrados. */
export type CourseAvailability =
  | 'AVAILABLE'
  | 'BLOCKED'
  | 'UNVERIFIED';

/** Progreso individual de una asignatura. */
export interface AcademicProgressEntry {
  courseId: number;
  result: CourseResult;
}

/** Resultado del cálculo de prerrequisitos. */
export interface CourseEligibility {
  courseId: number;
  code: string;
  status: CourseAvailability;
  missingPrerequisites: string[];
}

/** Respuesta del backend de progreso académico. */
export interface AcademicProgressResponse {
  progress: AcademicProgressEntry[];
  prerequisites: Record<string, string[]>;
  eligibility: CourseEligibility[];
}


//
// ==========================================
// PREFERENCIAS DE HORARIOS
// ==========================================
//

/** Jornadas que puede preferir el estudiante. */
export type PreferredShift =
  | 'MORNING'
  | 'AFTERNOON'
  | 'ANY';

/** Días de la semana con clases. */
export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';

/** Preferencias para generar un horario académico. */
export interface SchedulePreferences {
  preferredShift: PreferredShift;
  preferredFreeDay: Weekday | null;
  latestEndTime: '16:00' | '18:00' | '20:00';
  maxCourses: number;
}


//
// ==========================================
// GENERADOR DE HORARIOS INTELIGENTES
// ==========================================
//

export type GeneratorWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';

// Bloque de clases de una sección.
export interface GeneratedScheduleMeeting {
  day: GeneratorWeekday;
  startTime: string;
  endTime: string;
}

// Sección escogida para una asignatura.
export interface GeneratedScheduleSection {
  id: number;
  courseId: number;
  code: string;
  meetings: GeneratedScheduleMeeting[];
}

// Una línea del desglose del puntaje.
export interface ScheduleScoreDetail {
  key: 'freeDay' | 'shift' | 'lateEnd' | 'gaps' | 'days';
  label: string;
  points: number;
}

// Una combinación de secciones sin choques.
export interface GeneratedScheduleRecommendation {
  sections: GeneratedScheduleSection[];
  score: number;
  breakdown?: ScheduleScoreDetail[];
  daysOnCampus?: number;
  gapMinutes?: number;
}

// Respuesta del generador de horarios.
export interface GeneratedScheduleResponse {
  period: {
    year: number;
    semester: number;
    isDemo: boolean;
  };
  selectedCourseIds: number[];
  totalRecommendations: number;
  recommendations: GeneratedScheduleRecommendation[];
  truncated?: boolean;
  message: string;
}


//
// ==========================================
// HORARIOS GUARDADOS DEL ESTUDIANTE
// ==========================================
//

// Bloque de una sección guardada.
export interface SavedScheduleMeeting {
  day: GeneratorWeekday;
  startTime: string;
  endTime: string;
  type: string | null;
}

// Asignatura y sección del horario guardado.
export interface SavedScheduleSection {
  id: number;
  courseId: number;
  courseName: string;
  code: string;
  meetings: SavedScheduleMeeting[];
}

// Horario recuperado desde PostgreSQL.
export interface SavedScheduleResponse {
  id: number;

  period: {
    year: number;
    semester: number;
    isDemo: boolean;
  };

  sections: SavedScheduleSection[];

  createdAt: string;
  updatedAt: string;
}


//
// ==========================================
// EVENTOS DEL CALENDARIO DE LISTOCO
// ==========================================
//

// Categorías disponibles para los eventos.
export type CalendarEventCategory =
  | 'UNIVERSITY'
  | 'PERSONAL';

// Evento recuperado desde PostgreSQL.
export interface CalendarEvent {
  id: number;
  userId: number;

  title: string;
  eventDate: string;
  startTime: string | null;

  category: CalendarEventCategory;

  reminderMinutesBefore: number | null;

  createdAt: string;
  updatedAt: string;
}

// Datos necesarios para crear un evento.
export interface CreateCalendarEvent {
  title: string;
  eventDate: string;
  startTime: string | null;

  category: CalendarEventCategory;

  reminderMinutesBefore: number | null;
}

// Datos opcionales para editar un evento.
export type UpdateCalendarEvent =
  Partial<CreateCalendarEvent>;


//
// ==========================================
// TRÁMITES ACADÉMICOS DE LISTOCO
// ==========================================
//

// Los cuatro tipos de trámites disponibles.
export type AcademicRequestType =
  | 'ABSENCE_JUSTIFICATION'
  | 'OVERCAPACITY'
  | 'ENROLLMENT_PROBLEM'
  | 'OTHER';

// Estado inicial de una solicitud.
// Registrar un trámite NO significa
// que haya sido enviado por correo.
export type AcademicRequestStatus =
  | 'REGISTERED';

// Información de un archivo adjunto.
// Por seguridad, el backend no incluye
// el contenido binario en el historial.
export interface AcademicRequestAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

// Solicitud académica recuperada
// desde PostgreSQL.
export interface AcademicRequest {
  id: number;
  userId: number;

  type: AcademicRequestType;
  status: AcademicRequestStatus;

  // Correo del profesor o destinatario.
  recipientEmail: string;

  // Asignatura involucrada.
  courseName: string | null;

  // Fecha de inasistencia.
  // El backend devuelve un string ISO
  // o null cuando no corresponde.
  absenceDate: string | null;

  // Asunto para solicitudes generales.
  subject: string | null;

  // Explicación del estudiante.
  description: string;

  // Metadatos del justificativo adjunto.
  attachment: AcademicRequestAttachment | null;

  createdAt: string;
  updatedAt: string;
}

// Datos necesarios para crear un trámite.
// Los campos opcionales dependen
// del tipo de solicitud seleccionado.
export interface CreateAcademicRequest {
  type: AcademicRequestType;

  recipientEmail: string;

  courseName?: string;
  absenceDate?: string;
  subject?: string;

  description: string;

  // Archivo enviado mediante FormData.
  // Solo disponible para justificaciones
  // de inasistencia.
  attachment?: File | null;
}
