import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../core/models/role';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { RolesTabs } from '../roles-tabs';

@Component({
  selector: 'app-role-list',
  imports: [RouterLink, RolesTabs],
  templateUrl: './role-list.html',
  styleUrl: './role-list.scss',
})
export class RoleList {
  private readonly roleService = inject(RoleService);
  private readonly notify = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  protected readonly roles = signal<Role[]>([]);
  protected readonly totalPermissions = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deletingId = signal<number | null>(null);

  constructor() {
    this.load();
    this.roleService.permissions().subscribe({
      next: (groups) =>
        this.totalPermissions.set(groups.reduce((sum, g) => sum + g.permissions.length, 0)),
    });
  }

  protected remove(role: Role): void {
    const users =
      role.users_count > 0
        ? ` ${role.users_count} usuario(s) perderán este rol y sus permisos.`
        : '';
    if (!confirm(`¿Eliminar el rol ${role.name}?${users} Esta acción no se puede deshacer.`))
      return;

    this.deletingId.set(role.id);
    this.roleService.delete(role.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.notify.success(`Rol ${role.name} eliminado`);
        // Si el usuario actual tenía ese rol, sus permisos cambiaron
        if (this.auth.user()?.roles.some((r) => r.id === role.id)) this.auth.refresh();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        this.notify.error(err.error?.message ?? 'No se pudo eliminar el rol');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.roleService.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar la lista de roles');
      },
    });
  }
}
