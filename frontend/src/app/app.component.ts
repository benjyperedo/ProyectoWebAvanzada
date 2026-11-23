
import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

import { CalendarRemindersService } from './core/calendar-reminders.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [
    IonApp,
    IonRouterOutlet,
  ],
})
export class AppComponent implements OnInit {

  // Servicio encargado de revisar las alarmas
  // de los eventos del calendario.
  private readonly recordatorios =
    inject(CalendarRemindersService);

  // ==========================================
  // INICIAR RECORDATORIOS DE LISTOCO
  // ==========================================

  ngOnInit(): void {
    this.recordatorios.iniciar();
  }
}
