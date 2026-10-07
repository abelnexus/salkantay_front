import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/services/api.service';
import { AuthService } from './core/auth/auth.service';
import { NotificationService } from './core/services/notification.service';

interface Health {
  status: string;
  app: string;
  time: string;
}

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);

  protected readonly health = signal<Health | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Health>('health').subscribe({
      next: (res) => this.health.set(res),
      error: () => this.error.set('No se pudo conectar con la API'),
    });
  }
}
