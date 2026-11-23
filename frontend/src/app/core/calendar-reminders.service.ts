
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../environments/environment';
import { CalendarEvent } from './model';

@Injectable({
  providedIn: 'root',
})
export class CalendarRemindersService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = environment.apiUrl;

  // Revisar recordatorios cada minuto.
  private readonly intervaloMs = 60_000;

  // Permitir un aviso ligeramente atrasado
  // si el navegador suspendió temporalmente la pestaña.
  private readonly toleranciaMs = 10 * 60_000;

  private intervalo: ReturnType<typeof setInterval> | null = null;

  private eventos: CalendarEvent[] = [];

  private consultando = false;

  readonly mensajePermiso = signal('');

  // ==========================================
  // INICIAR RECORDATORIOS
  // ==========================================

  iniciar(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Evitar crear múltiples temporizadores.
    if (this.intervalo !== null) {
      return;
    }

    this.cargarEventos();

    this.intervalo = setInterval(() => {
      this.cargarEventos();
      this.comprobarRecordatorios();
    }, this.intervaloMs);

    // Revisar nuevamente cuando el estudiante
    // regrese a la pestaña.
    document.addEventListener(
      'visibilitychange',
      this.alVolverAPestana,
    );
  }

  private readonly alVolverAPestana = (): void => {
    if (!document.hidden) {
      this.cargarEventos();
    }
  };

  // ==========================================
  // SOLICITAR PERMISO DEL NAVEGADOR
  // ==========================================

  async activarNotificaciones(): Promise<void> {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      this.mensajePermiso.set(
        'Este navegador no admite notificaciones. Se utilizarán avisos dentro de LISTOCO.',
      );
      return;
    }

    if (!window.isSecureContext) {
      this.mensajePermiso.set(
        'Las notificaciones requieren localhost o una conexión HTTPS.',
      );
      return;
    }

    try {
      const permiso = await Notification.requestPermission();

      if (permiso === 'granted') {
        this.mensajePermiso.set(
          'Notificaciones del navegador activadas.',
        );
      } else {
        this.mensajePermiso.set(
          'No se autorizaron las notificaciones. LISTOCO utilizará avisos en pantalla.',
        );
      }
    } catch {
      this.mensajePermiso.set(
        'No fue posible activar las notificaciones del navegador.',
      );
    }
  }

  // ==========================================
  // CONSULTAR EVENTOS GUARDADOS
  // ==========================================

  private cargarEventos(): void {
    if (this.consultando) {
      return;
    }

    this.consultando = true;

    // Sin filtros de mes: necesitamos comprobar
    // alarmas aunque el estudiante esté mirando
    // otro mes del calendario.
    this.http.get<CalendarEvent[]>(
      `${this.apiUrl}/calendar-events`,
    ).subscribe({
      next: (eventos) => {
        this.eventos = eventos;
        this.consultando = false;

        this.comprobarRecordatorios();
      },

      error: () => {
        // Puede ocurrir si el estudiante aún
        // no ha iniciado sesión.
        this.eventos = [];
        this.consultando = false;
      },
    });
  }

  // ==========================================
  // COMPROBAR RECORDATORIOS
  // ==========================================

  private comprobarRecordatorios(): void {
    const ahora = Date.now();

    for (const evento of this.eventos) {
      if (
        evento.reminderMinutesBefore === null ||
        evento.startTime === null
      ) {
        continue;
      }

      const [year, month, day] = evento.eventDate
        .split('-')
        .map(Number);

      const [hour, minute] = evento.startTime
        .split(':')
        .map(Number);

      if (
        ![year, month, day, hour, minute].every(
          Number.isFinite,
        )
      ) {
        continue;
      }

      // Crear la fecha utilizando la zona horaria
      // local del estudiante.
      const fechaEvento = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
      );

      const fechaAviso =
        fechaEvento.getTime() -
        evento.reminderMinutesBefore * 60_000;

      const diferencia = ahora - fechaAviso;

      if (
        diferencia < 0 ||
        diferencia > this.toleranciaMs
      ) {
        continue;
      }

      // Identificador único del recordatorio.
      const clave = [
        'listoco-recordatorio',
        evento.userId,
        evento.id,
        evento.eventDate,
        evento.startTime,
        evento.reminderMinutesBefore,
      ].join(':');

      // Evitar notificaciones repetidas,
      // incluso al recargar la página.
      try {
        if (localStorage.getItem(clave) === '1') {
          continue;
        }

        localStorage.setItem(clave, '1');
      } catch {
        // Continuar si el almacenamiento
        // del navegador no está disponible.
      }

      this.mostrarAviso(evento);
    }
  }

  // ==========================================
  // MOSTRAR NOTIFICACIÓN
  // ==========================================

  private mostrarAviso(evento: CalendarEvent): void {
    const categoria =
      evento.category === 'UNIVERSITY'
        ? 'Universidad'
        : 'Personal';

    const mensaje =
      `${categoria}: ${evento.title}\n` +
      `${evento.startTime} · ${evento.eventDate}`;

    // Notificación del sistema, cuando está permitida.
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const notificacion = new Notification(
          'LISTOCO - Recordatorio',
          {
            body: mensaje,
            tag: `listoco-evento-${evento.id}`,
          },
        );

        notificacion.onclick = () => {
          window.focus();
          notificacion.close();
        };

        return;
      } catch {
        // Si falla, mostrar un aviso alternativo.
      }
    }

    // Aviso básico cuando el navegador está abierto.
    window.alert(
      `🔔 LISTOCO - Recordatorio\n\n${mensaje}`,
    );
  }
}
