
import { Component, inject, signal } from '@angular/core';

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
  PreferredShift,
  SchedulePreferences,
  Weekday,
} from '../core/model';

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

  // ==========================================
  // ESTADOS DE CARGA Y MENSAJES
  // ==========================================

  readonly cargandoPreferencias = signal(false);
  readonly guardandoPreferencias = signal(false);

  readonly mensajePreferencias = signal('');
  readonly errorPreferencias = signal('');

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  constructor() {
    this.cargarPreferencias();
  }

  // ==========================================
  // CARGAR PREFERENCIAS DESDE POSTGRESQL
  // ==========================================

  cargarPreferencias(): void {
    this.cargandoPreferencias.set(true);
    this.errorPreferencias.set('');

    this.api.getSchedulePreferences().subscribe({
      next: (respuesta) => {
        this.preferencias.set(respuesta);
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

    this.mensajePreferencias.set('');
  }

  cambiarDiaLibre(dia: Weekday | null): void {
    this.preferencias.update(actual => ({
      ...actual,
      preferredFreeDay: dia,
    }));

    this.mensajePreferencias.set('');
  }

  cambiarHoraTermino(
    hora: SchedulePreferences['latestEndTime'],
  ): void {
    this.preferencias.update(actual => ({
      ...actual,
      latestEndTime: hora,
    }));

    this.mensajePreferencias.set('');
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

    this.mensajePreferencias.set('');
  }

  // ==========================================
  // GUARDAR PREFERENCIAS EN POSTGRESQL
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
        this.guardandoPreferencias.set(false);

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
}
