
import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';

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

import type {
  AcademicRequest,
  AcademicRequestType,
  CreateAcademicRequest,
} from '../core/model';

// ==========================================
// PÁGINA DE TRÁMITES ACADÉMICOS
// ==========================================

@Component({
  selector: 'app-tramites',
  templateUrl: 'tramites.page.html',
  styleUrls: ['tramites.page.scss'],
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
export class TramitesPage {

  private readonly api = inject(ApiService);

  // ==========================================
  // HISTORIAL REAL DE TRÁMITES
  // ==========================================

  readonly tramites = signal<AcademicRequest[]>([]);

  readonly cargandoTramites = signal(false);

  readonly errorTramites = signal('');

  readonly mensajeExito = signal('');

  // ==========================================
  // ESTADO DEL FORMULARIO
  // ==========================================

  readonly formularioAbierto = signal(false);

  readonly tipoSeleccionado =
    signal<AcademicRequestType | null>(null);

  readonly destinatario = signal('');

  readonly asignatura = signal('');

  readonly fechaInasistencia = signal('');

  readonly asunto = signal('');

  readonly descripcion = signal('');

  readonly archivoAdjunto = signal<File | null>(null);

  readonly guardandoTramite = signal(false);

  readonly errorFormulario = signal('');

  // ==========================================
  // DESCARGA DE JUSTIFICATIVOS
  // ==========================================

  readonly descargandoId = signal<number | null>(null);

  readonly errorDescarga = signal('');

  // ==========================================
  // INFORMACIÓN DEL FORMULARIO
  // ==========================================

  readonly tituloFormulario = computed(() => {
    const tipo = this.tipoSeleccionado();

    if (tipo === 'ABSENCE_JUSTIFICATION') {
      return 'Justificar inasistencia';
    }

    if (tipo === 'OVERCAPACITY') {
      return 'Solicitar sobrecupo';
    }

    if (tipo === 'ENROLLMENT_PROBLEM') {
      return 'Problema de inscripción';
    }

    if (tipo === 'OTHER') {
      return 'Otra solicitud';
    }

    return 'Nuevo trámite';
  });

  readonly requiereAsignatura = computed(() => {
    const tipo = this.tipoSeleccionado();

    return (
      tipo === 'ABSENCE_JUSTIFICATION' ||
      tipo === 'OVERCAPACITY' ||
      tipo === 'ENROLLMENT_PROBLEM'
    );
  });

  readonly esInasistencia = computed(() => {
    return (
      this.tipoSeleccionado() ===
      'ABSENCE_JUSTIFICATION'
    );
  });

  readonly esOtraSolicitud = computed(() => {
    return this.tipoSeleccionado() === 'OTHER';
  });

  readonly etiquetaDescripcion = computed(() => {
    const tipo = this.tipoSeleccionado();

    if (tipo === 'ABSENCE_JUSTIFICATION') {
      return 'Explicación de la inasistencia';
    }

    if (tipo === 'OVERCAPACITY') {
      return 'Justificación del sobrecupo';
    }

    if (tipo === 'ENROLLMENT_PROBLEM') {
      return 'Descripción del problema';
    }

    return 'Descripción de la solicitud';
  });

  // ==========================================
  // CARGAR TRÁMITES AL ENTRAR A LA PÁGINA
  // ==========================================

  ionViewWillEnter(): void {
    this.cargarTramites();
  }

  // ==========================================
  // CONSULTAR MIS TRÁMITES
  // ==========================================

  cargarTramites(): void {

    this.cargandoTramites.set(true);

    this.errorTramites.set('');

    this.api.getAcademicRequests().subscribe({

      next: (respuesta) => {

        this.tramites.set(respuesta);

        this.cargandoTramites.set(false);
      },

      error: (error: unknown) => {

        this.cargandoTramites.set(false);

        this.errorTramites.set(
          this.obtenerMensajeError(
            error,
            'No fue posible cargar tus trámites.',
          ),
        );
      },

    });
  }

  // ==========================================
  // ABRIR FORMULARIO
  // ==========================================

  abrirFormulario(tipo: AcademicRequestType): void {

    this.tipoSeleccionado.set(tipo);

    this.destinatario.set('');

    this.asignatura.set('');

    this.fechaInasistencia.set('');

    this.asunto.set('');

    this.descripcion.set('');

    this.archivoAdjunto.set(null);

    this.errorFormulario.set('');

    this.mensajeExito.set('');

    this.formularioAbierto.set(true);
  }

  // ==========================================
  // CERRAR FORMULARIO
  // ==========================================

  cerrarFormulario(): void {

    if (this.guardandoTramite()) {
      return;
    }

    this.formularioAbierto.set(false);

    this.tipoSeleccionado.set(null);

    this.archivoAdjunto.set(null);

    this.errorFormulario.set('');
  }

  // ==========================================
  // ACTUALIZAR CAMPOS DEL FORMULARIO
  // ==========================================

  cambiarDestinatario(valor: string): void {
    this.destinatario.set(valor);
  }

  cambiarAsignatura(valor: string): void {
    this.asignatura.set(valor);
  }

  cambiarFechaInasistencia(valor: string): void {
    this.fechaInasistencia.set(valor);
  }

  cambiarAsunto(valor: string): void {
    this.asunto.set(valor);
  }

  cambiarDescripcion(valor: string): void {
    this.descripcion.set(valor);
  }

  // ==========================================
  // SELECCIONAR JUSTIFICATIVO
  // ==========================================

  seleccionarArchivo(evento: Event): void {

    const input =
      evento.target as HTMLInputElement;

    const archivo = input.files?.[0];

    if (!archivo) {
      this.archivoAdjunto.set(null);
      return;
    }

    // Máximo: 5 MB.
    const maximoBytes = 5 * 1024 * 1024;

    if (archivo.size > maximoBytes) {

      this.archivoAdjunto.set(null);

      this.errorFormulario.set(
        'El archivo no puede superar los 5 MB.',
      );

      input.value = '';

      return;
    }

    const extension = archivo.name
      .split('.')
      .pop()
      ?.toLowerCase();

    const permitidas = [
      'pdf',
      'png',
      'jpg',
      'jpeg',
    ];

    if (
      !extension ||
      !permitidas.includes(extension)
    ) {

      this.archivoAdjunto.set(null);

      this.errorFormulario.set(
        'Solo puedes adjuntar archivos PDF, PNG o JPG.',
      );

      input.value = '';

      return;
    }

    this.archivoAdjunto.set(archivo);

    this.errorFormulario.set('');
  }

  // ==========================================
  // ELIMINAR ARCHIVO DEL FORMULARIO
  // ==========================================

  quitarArchivo(): void {
    this.archivoAdjunto.set(null);
    this.errorFormulario.set('');
  }

  // ==========================================
  // VALIDAR CORREO ELECTRÓNICO
  // ==========================================

  private esCorreoValido(correo: string): boolean {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      correo,
    );
  }

  // ==========================================
  // VALIDAR DATOS ANTES DE GUARDAR
  // ==========================================

  private validarFormulario(): boolean {

    const tipo = this.tipoSeleccionado();

    const correo = this.destinatario().trim();

    const asignatura = this.asignatura().trim();

    const asunto = this.asunto().trim();

    const descripcion = this.descripcion().trim();

    if (!tipo) {

      this.errorFormulario.set(
        'Selecciona un tipo de trámite.',
      );

      return false;
    }

    if (
      !correo ||
      correo.length > 255 ||
      !this.esCorreoValido(correo)
    ) {

      this.errorFormulario.set(
        'Ingresa un correo electrónico válido.',
      );

      return false;
    }

    if (
      this.requiereAsignatura() &&
      (!asignatura || asignatura.length > 150)
    ) {

      this.errorFormulario.set(
        'Ingresa una asignatura válida (máximo 150 caracteres).',
      );

      return false;
    }

    if (this.esInasistencia()) {

      const fecha = this.fechaInasistencia();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ) {

        this.errorFormulario.set(
          'Selecciona la fecha de la inasistencia.',
        );

        return false;
      }

      const fechaComprobada = new Date(
        `${fecha}T00:00:00.000Z`,
      );

      if (
        Number.isNaN(fechaComprobada.getTime()) ||
        fechaComprobada.toISOString().slice(0, 10)
          !== fecha
      ) {

        this.errorFormulario.set(
          'La fecha de inasistencia no es válida.',
        );

        return false;
      }
    }

    if (
      this.esOtraSolicitud() &&
      (!asunto || asunto.length > 150)
    ) {

      this.errorFormulario.set(
        'Ingresa un asunto válido (máximo 150 caracteres).',
      );

      return false;
    }

    if (
      !descripcion ||
      descripcion.length > 4000
    ) {

      this.errorFormulario.set(
        'La descripción es obligatoria y no puede superar los 4000 caracteres.',
      );

      return false;
    }

    return true;
  }

  // ==========================================
  // REGISTRAR TRÁMITE EN POSTGRESQL
  // ==========================================

  guardarTramite(): void {

    if (this.guardandoTramite()) {
      return;
    }

    this.errorFormulario.set('');

    this.mensajeExito.set('');

    if (!this.validarFormulario()) {
      return;
    }

    const tipo = this.tipoSeleccionado();

    if (!tipo) {
      return;
    }

    const datos: CreateAcademicRequest = {

      type: tipo,

      recipientEmail: this.destinatario().trim(),

      description: this.descripcion().trim(),

    };

    // Asignatura involucrada.
    if (this.requiereAsignatura()) {
      datos.courseName = this.asignatura().trim();
    }

    // Fecha y justificativo de inasistencia.
    if (tipo === 'ABSENCE_JUSTIFICATION') {

      datos.absenceDate = this.fechaInasistencia();

      if (this.archivoAdjunto()) {
        datos.attachment = this.archivoAdjunto();
      }
    }

    // Asunto para solicitudes generales.
    if (tipo === 'OTHER') {
      datos.subject = this.asunto().trim();
    }

    this.guardandoTramite.set(true);

    this.api.createAcademicRequest(datos).subscribe({

      next: () => {

        this.guardandoTramite.set(false);

        this.cerrarFormulario();

        this.mensajeExito.set(
          'Tu trámite fue registrado correctamente en LISTOCO. ' +
          'Recuerda que todavía no se envía por correo.',
        );

        // Recuperar el historial actualizado
        // desde PostgreSQL.
        this.cargarTramites();
      },

      error: (error: unknown) => {

        this.guardandoTramite.set(false);

        this.errorFormulario.set(
          this.obtenerMensajeError(
            error,
            'No fue posible registrar el trámite.',
          ),
        );
      },

    });
  }

  // ==========================================
  // DESCARGAR JUSTIFICATIVO
  // ==========================================

  descargarAdjunto(tramite: AcademicRequest): void {

    if (
      !tramite.attachment ||
      this.descargandoId() !== null
    ) {
      return;
    }

    this.errorDescarga.set('');

    this.descargandoId.set(tramite.id);

    this.api
      .downloadAcademicRequestAttachment(tramite.id)
      .subscribe({

        next: (archivo: Blob) => {

          const url = URL.createObjectURL(archivo);

          const enlace =
            document.createElement('a');

          const nombreSeguro =
            tramite.attachment!.fileName.replace(
              /[\\/:*?"<>|\x00-\x1F]/g,
              '_',
            );

          enlace.href = url;

          enlace.download = nombreSeguro;

          document.body.appendChild(enlace);

          enlace.click();

          document.body.removeChild(enlace);

          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);

          this.descargandoId.set(null);
        },

        error: (error: unknown) => {

          this.descargandoId.set(null);

          this.errorDescarga.set(
            this.obtenerMensajeError(
              error,
              'No fue posible descargar el justificativo.',
            ),
          );
        },

      });
  }

  // ==========================================
  // NOMBRE DEL TIPO DE TRÁMITE
  // ==========================================

  nombreTipo(tipo: AcademicRequestType): string {

    switch (tipo) {

      case 'ABSENCE_JUSTIFICATION':
        return 'Justificación de inasistencia';

      case 'OVERCAPACITY':
        return 'Solicitud de sobrecupo';

      case 'ENROLLMENT_PROBLEM':
        return 'Problema de inscripción';

      case 'OTHER':
        return 'Otra solicitud';

    }
  }

  // ==========================================
  // TEXTO DEL ESTADO
  // ==========================================

  nombreEstado(): string {
    return 'Registrado';
  }

  // ==========================================
  // FORMATEAR FECHA DE CREACIÓN
  // ==========================================

  formatearFechaCreacion(fecha: string): string {

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return fecha;
    }

    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(valor);
  }

  // ==========================================
  // FORMATEAR FECHA DE INASISTENCIA
  // ==========================================

  formatearFechaInasistencia(
    fecha: string | null,
  ): string {

    if (!fecha) {
      return '';
    }

    // Evitamos errores de zona horaria
    // al convertir fechas DATE de PostgreSQL.
    const partes = fecha.slice(0, 10).split('-');

    if (partes.length !== 3) {
      return fecha;
    }

    const [anio, mes, dia] = partes;

    return `${dia}/${mes}/${anio}`;
  }

  // ==========================================
  // INTERPRETAR ERRORES DE LA API
  // ==========================================

  private obtenerMensajeError(
    error: unknown,
    mensajePorDefecto: string,
  ): string {

    if (error instanceof HttpErrorResponse) {

      if (error.status === 0) {
        return 'No fue posible conectar con el servidor.';
      }

      if (error.status === 401) {
        return 'Tu sesión no es válida. Inicia sesión nuevamente.';
      }

      if (error.status === 413) {
        return 'El archivo supera el tamaño máximo permitido.';
      }

      const mensaje = error.error?.message;

      if (typeof mensaje === 'string') {
        return mensaje;
      }

      if (Array.isArray(mensaje)) {
        return mensaje.join(' ');
      }
    }

    return mensajePorDefecto;
  }
}
