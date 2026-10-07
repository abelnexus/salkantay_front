import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  type: 'success' | 'error';
  text: string;
}

/** Mensajes tipo "toast" que se cierran solos. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  readonly items = signal<Notification[]>([]);

  success(text: string): void {
    this.push('success', text);
  }

  error(text: string): void {
    this.push('error', text);
  }

  dismiss(id: number): void {
    this.items.update((items) => items.filter((n) => n.id !== id));
  }

  private push(type: Notification['type'], text: string): void {
    const id = this.nextId++;
    this.items.update((items) => [...items, { id, type, text }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
