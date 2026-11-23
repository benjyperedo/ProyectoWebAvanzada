
import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
} from '@ionic/angular';

import { ApiService } from '../core/api.service';
import { CalendarRemindersService } from '../core/calendar-reminders.service';
import { describeError } from '../core/auth.interceptor';

import {
  CalendarEvent,
  CalendarEventCategory,
  CreateCalendarEvent,
} from '../core/model';

// ==========================================
// DÍA DEL CALENDARIO
// ==========================================

interface CalendarDay {
  date: string;
  number: number;
  currentMonth: boolean;
  today: boolean;
  selected: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-calendario',
  templateUrl: 'calendario.page.html',
  styleUrls: ['calendario.page.scss'],
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonBadge,
  ],
})
export class CalendarioPage {
  private readonly api = inject(ApiService);

  private readonly recordatorios = inject(CalendarRemindersService);

  // Mensaje que indica si las notificaciones fueron autorizadas.
  readonly mensajePermisoNotificaciones =
    this.recordatorios.mensajePermiso;


  // ==========================================
  // FECHA Y NAVEGACIÓN
  // ==========================================

  private readonly hoy = new Date();

  readonly mesActual = signal(
    new Date(
      this.hoy.getFullYear(),
      this.hoy.getMonth(),
      1,
    ),
  );

  readonly fechaSeleccionada = signal(
    this.formatearFecha(this.hoy),
  );

  readonly nombresDias = [
    'Lun',
    'Mar',
    'Mié',
    'Jue',
    'Vie',
    'Sáb',
    'Dom',
  ];

  readonly tituloMes = computed(() => {
    return new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric',
    }).format(this.mesActual());
  });

  readonly tituloFechaSeleccionada = computed(() => {
    const [year, month, day] =
      this.fechaSeleccionada()
        .split('-')
        .map(Number);

    return new Intl.DateTimeFormat('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  });

  // ==========================================
  // EVENTOS RECUPERADOS DESDE POSTGRESQL
  // ==========================================

  readonly eventos = signal<CalendarEvent[]>([]);

  readonly cargandoEventos = signal(false);
  readonly errorEventos = signal('');
  readonly mensajeExito = signal('');

  // Evita que una consulta antigua reemplace
  // los eventos de un mes más reciente.
  private versionConsulta = 0;

  // ==========================================
  // FORMULARIO DE EVENTOS
  // ==========================================

  readonly formularioAbierto = signal(false);

  readonly eventoEditandoId = signal<number | null>(null);

  readonly tituloEvento = signal('');
  readonly fechaEvento = signal('');
  readonly horaEvento = signal('');

  readonly categoriaEvento =
    signal<CalendarEventCategory>('UNIVERSITY');

  readonly recordatorioActivo = signal(false);
  readonly minutosRecordatorio = signal(15);

  readonly guardandoEvento = signal(false);
  readonly eliminandoEventoId = signal<number | null>(null);

  readonly errorFormulario = signal('');

  // Opciones simples de recordatorio.
  readonly opcionesRecordatorio = [
    { minutos: 0, texto: 'A la hora del evento' },
    { minutos: 5, texto: '5 minutos antes' },
    { minutos: 15, texto: '15 minutos antes' },
    { minutos: 30, texto: '30 minutos antes' },
    { minutos: 60, texto: '1 hora antes' },
    { minutos: 1440, texto: '1 día antes' },
  ];

  // ==========================================
  // EVENTOS DEL DÍA SELECCIONADO
  // ==========================================

  readonly eventosDiaSeleccionado = computed(() => {
    const fecha = this.fechaSeleccionada();

    return this.eventos()
      .filter(evento => evento.eventDate === fecha)
      .sort((a, b) => {
        // Eventos sin hora aparecen primero.
        const horaA = a.startTime ?? '';
        const horaB = b.startTime ?? '';

        return horaA.localeCompare(horaB);
      });
  });

  // ==========================================
  // CONSTRUIR LA CUADRÍCULA MENSUAL
  // ==========================================

  readonly diasCalendario = computed<CalendarDay[]>(() => {
    const mes = this.mesActual();

    const year = mes.getFullYear();
    const month = mes.getMonth();

    const primerDia = new Date(year, month, 1);

    // JavaScript: domingo = 0.
    // Nuestro calendario comienza en lunes.
    const desplazamiento = (
      primerDia.getDay() + 6
    ) % 7;

    const fechaInicio = new Date(
      year,
      month,
      1 - desplazamiento,
    );

    const fechaHoy = this.formatearFecha(new Date());
    const fechaActiva = this.fechaSeleccionada();

    const eventos = this.eventos();

    const dias: CalendarDay[] = [];

    // Seis semanas para mantener un calendario estable.
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(
        fechaInicio.getFullYear(),
        fechaInicio.getMonth(),
        fechaInicio.getDate() + i,
      );

      const fechaTexto = this.formatearFecha(fecha);

      dias.push({
        date: fechaTexto,
        number: fecha.getDate(),
        currentMonth:
          fecha.getMonth() === month &&
          fecha.getFullYear() === year,
        today: fechaTexto === fechaHoy,
        selected: fechaTexto === fechaActiva,
        events: eventos.filter(
          evento => evento.eventDate === fechaTexto,
        ),
      });
    }

    return dias;
  });

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  constructor() {
    this.cargarEventos();
  }

  // ==========================================
  // FORMATEAR FECHAS SIN CAMBIAR DE DÍA
  // ==========================================

  private formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();

    const month = String(
      fecha.getMonth() + 1,
    ).padStart(2, '0');

    const day = String(
      fecha.getDate(),
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // ==========================================
  // CAMBIAR MES
  // ==========================================

  cambiarMes(desplazamiento: number): void {
    const actual = this.mesActual();

    const nuevoMes = new Date(
      actual.getFullYear(),
      actual.getMonth() + desplazamiento,
      1,
    );

    this.mesActual.set(nuevoMes);

    // Seleccionamos el primer día del nuevo mes.
    this.fechaSeleccionada.set(
      this.formatearFecha(nuevoMes),
    );

    this.mensajeExito.set('');
    this.cargarEventos();
  }

  // ==========================================
  // VOLVER A HOY
  // ==========================================

  irAHoy(): void {
    const hoy = new Date();

    this.mesActual.set(
      new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        1,
      ),
    );

    this.fechaSeleccionada.set(
      this.formatearFecha(hoy),
    );

    this.cargarEventos();
  }

  // ==========================================
  // SELECCIONAR UN DÍA
  // ==========================================

  seleccionarDia(dia: CalendarDay): void {
    this.fechaSeleccionada.set(dia.date);

    this.mensajeExito.set('');

    // Permitir seleccionar los días de otros meses
    // que aparecen en los extremos del calendario.
    if (!dia.currentMonth) {
      const [year, month] = dia.date
        .split('-')
        .map(Number);

      this.mesActual.set(
        new Date(year, month - 1, 1),
      );

      this.cargarEventos();
    }
  }

  // ==========================================
  // CONSULTAR EVENTOS DEL MES
  // ==========================================

  cargarEventos(): void {
    const mes = this.mesActual();

    const year = mes.getFullYear();
    const month = mes.getMonth() + 1;

    const version = ++this.versionConsulta;

    this.cargandoEventos.set(true);
    this.errorEventos.set('');

    this.api.getCalendarEvents(year, month).subscribe({
      next: (respuesta) => {
        if (version !== this.versionConsulta) {
          return;
        }

        this.eventos.set(respuesta);
        this.cargandoEventos.set(false);
      },

      error: (error: unknown) => {
        if (version !== this.versionConsulta) {
          return;
        }

        this.eventos.set([]);
        this.errorEventos.set(describeError(error));
        this.cargandoEventos.set(false);
      },
    });
  }

  // ==========================================
  // ABRIR FORMULARIO PARA CREAR EVENTO
  // ==========================================

  abrirNuevoEvento(): void {
    if (this.guardandoEvento()) {
      return;
    }

    this.eventoEditandoId.set(null);

    this.tituloEvento.set('');
    this.fechaEvento.set(this.fechaSeleccionada());
    this.horaEvento.set('');

    this.categoriaEvento.set('UNIVERSITY');

    this.recordatorioActivo.set(false);
    this.minutosRecordatorio.set(15);

    this.errorFormulario.set('');
    this.mensajeExito.set('');

    this.formularioAbierto.set(true);
  }

  // ==========================================
  // ABRIR FORMULARIO PARA EDITAR EVENTO
  // ==========================================

  editarEvento(evento: CalendarEvent): void {
    if (this.guardandoEvento()) {
      return;
    }

    this.eventoEditandoId.set(evento.id);

    this.tituloEvento.set(evento.title);
    this.fechaEvento.set(evento.eventDate);
    this.horaEvento.set(evento.startTime ?? '');

    this.categoriaEvento.set(evento.category);

    this.recordatorioActivo.set(
      evento.reminderMinutesBefore !== null,
    );

    this.minutosRecordatorio.set(
      evento.reminderMinutesBefore ?? 15,
    );

    this.errorFormulario.set('');
    this.mensajeExito.set('');

    this.formularioAbierto.set(true);
  }

  // ==========================================
  // CERRAR FORMULARIO
  // ==========================================

  cerrarFormulario(): void {
    if (this.guardandoEvento()) {
      return;
    }

    this.formularioAbierto.set(false);
    this.errorFormulario.set('');
  }

  // ==========================================
  // CAMBIAR VALORES DEL FORMULARIO
  // ==========================================

  cambiarTitulo(valor: string): void {
    this.tituloEvento.set(valor);
  }

  cambiarFecha(valor: string): void {
    this.fechaEvento.set(valor);
  }

  cambiarHora(valor: string): void {
    this.horaEvento.set(valor);
  }

  cambiarCategoria(
    valor: CalendarEventCategory,
  ): void {
    if (
      valor === 'UNIVERSITY' ||
      valor === 'PERSONAL'
    ) {
      this.categoriaEvento.set(valor);
    }
  }

  cambiarRecordatorio(activado: boolean): void {
    this.recordatorioActivo.set(activado);
  }

  cambiarMinutosRecordatorio(valor: number): void {
    if (
      Number.isInteger(valor) &&
      valor >= 0 &&
      valor <= 1440
    ) {
      this.minutosRecordatorio.set(valor);
    }
  }

  // ==========================================
  // VALIDAR FECHA
  // ==========================================

  private esFechaValida(valor: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return false;
    }

    const fecha = new Date(
      `${valor}T00:00:00.000Z`,
    );

    return (
      !Number.isNaN(fecha.getTime()) &&
      fecha.toISOString().slice(0, 10) === valor
    );
  }

  // ==========================================
  // GUARDAR EVENTO
  // ==========================================

  guardarEvento(): void {
    if (this.guardandoEvento()) {
      return;
    }

    this.errorFormulario.set('');
    this.mensajeExito.set('');

    const titulo = this.tituloEvento().trim();
    const fecha = this.fechaEvento();
    const hora = this.horaEvento().trim();

    if (titulo.length === 0 || titulo.length > 150) {
      this.errorFormulario.set(
        'Ingresa un nombre de 1 a 150 caracteres.',
      );
      return;
    }

    if (!this.esFechaValida(fecha)) {
      this.errorFormulario.set(
        'Selecciona una fecha válida.',
      );
      return;
    }

    if (
      hora !== '' &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      this.errorFormulario.set(
        'La hora debe tener el formato HH:MM.',
      );
      return;
    }

    if (this.recordatorioActivo() && hora === '') {
      this.errorFormulario.set(
        'Para activar una alarma debes indicar una hora.',
      );
      return;
    }

    const datos: CreateCalendarEvent = {
      title: titulo,
      eventDate: fecha,
      startTime: hora === '' ? null : hora,
      category: this.categoriaEvento(),
      reminderMinutesBefore:
        this.recordatorioActivo()
          ? this.minutosRecordatorio()
          : null,
    };

    const idEditando = this.eventoEditandoId();

    this.guardandoEvento.set(true);

    const solicitud =
      idEditando === null
        ? this.api.createCalendarEvent(datos)
        : this.api.updateCalendarEvent(
            idEditando,
            datos,
          );

    solicitud.subscribe({
      next: (evento) => {
        this.guardandoEvento.set(false);
        this.formularioAbierto.set(false);

        this.mensajeExito.set(
          idEditando === null
            ? 'Evento creado correctamente.'
            : 'Evento actualizado correctamente.',
        );

        // Mostrar el mes correspondiente al evento.
        const [year, month] = evento.eventDate
          .split('-')
          .map(Number);

        this.mesActual.set(
          new Date(year, month - 1, 1),
        );

        this.fechaSeleccionada.set(
          evento.eventDate,
        );

        // Recuperar los datos actualizados.
        this.cargarEventos();
      },

      error: (error: unknown) => {
        this.errorFormulario.set(
          describeError(error),
        );

        this.guardandoEvento.set(false);
      },
    });
  }

  // ==========================================
  // ELIMINAR EVENTO
  // ==========================================

  eliminarEvento(evento: CalendarEvent): void {
    if (this.eliminandoEventoId() !== null) {
      return;
    }

    const confirmar = window.confirm(
      `¿Quieres eliminar el evento "${evento.title}"?`,
    );

    if (!confirmar) {
      return;
    }

    this.errorEventos.set('');
    this.mensajeExito.set('');

    this.eliminandoEventoId.set(evento.id);

    this.api.deleteCalendarEvent(evento.id).subscribe({
      next: () => {
        this.eliminandoEventoId.set(null);

        this.mensajeExito.set(
          'Evento eliminado correctamente.',
        );

        this.cargarEventos();
      },

      error: (error: unknown) => {
        this.errorEventos.set(
          describeError(error),
        );

        this.eliminandoEventoId.set(null);
      },
    });
  }

  // ==========================================
  // OBTENER NOMBRE DE LA CATEGORÍA
  // ==========================================

  nombreCategoria(
    categoria: CalendarEventCategory,
  ): string {
    return categoria === 'UNIVERSITY'
      ? 'Universidad'
      : 'Personal';
  }

  // ==========================================
  // OBTENER COLOR DE LA CATEGORÍA
  // ==========================================

  colorCategoria(
    categoria: CalendarEventCategory,
  ): string {
    return categoria === 'UNIVERSITY'
      ? '#3B82F6'
      : '#22A06B';
  }

  // ==========================================
  // ACTIVAR NOTIFICACIONES DEL NAVEGADOR
  // ==========================================

  async activarNotificaciones(): Promise<void> {
    await this.recordatorios.activarNotificaciones();
  }
}
