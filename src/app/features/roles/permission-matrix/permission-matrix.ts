import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionGroup, Role } from '../../../core/models/role';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { RolesTabs } from '../roles-tabs';

/** Permisos marcados por id de rol. */
type Grants = ReadonlyMap<number, ReadonlySet<string>>;

/**
 * Tabla roles × permisos. Los cambios se acumulan y se guardan juntos
 * (una sola petición), o se descartan.
 */
@Component({
  selector: 'app-permission-matrix',
  imports: [RouterLink, RolesTabs],
  templateUrl: './permission-matrix.html',
  styleUrl: './permission-matrix.scss',
})
export class PermissionMatrix {
  private readonly roleService = inject(RoleService);
  private readonly notify = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  protected readonly roles = signal<Role[]>([]);
  protected readonly groups = signal<PermissionGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Estado guardado en el servidor y estado editado en pantalla. */
  private readonly original = signal<Grants>(new Map());
  private readonly grants = signal<Grants>(new Map());

  protected readonly canEdit = computed(() => this.auth.can('roles.update'));

  /** Roles editables cuyos permisos cambiaron respecto a lo guardado. */
  protected readonly dirtyRoles = computed(() =>
    this.roles().filter((role) => {
      if (role.is_system) return false;
      const before = this.original().get(role.id) ?? new Set<string>();
      const after = this.grants().get(role.id) ?? new Set<string>();
      return before.size !== after.size || [...after].some((p) => !before.has(p));
    }),
  );

  protected readonly dirtyRolesNames = computed(() =>
    this.dirtyRoles()
      .map((r) => r.name)
      .join(', '),
  );

  constructor() {
    forkJoin([this.roleService.list(), this.roleService.permissions()]).subscribe({
      next: ([roles, groups]) => {
        this.groups.set(groups);
        this.setRoles(roles);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar la matriz de permisos');
      },
    });
  }

  protected grantsCount(role: Role): number {
    return this.grants().get(role.id)?.size ?? 0;
  }

  protected has(role: Role, permission: string): boolean {
    return this.grants().get(role.id)?.has(permission) ?? false;
  }

  /** ¿Esta celda difiere de lo guardado? (para resaltarla). */
  protected changed(role: Role, permission: string): boolean {
    return this.has(role, permission) !== (this.original().get(role.id)?.has(permission) ?? false);
  }

  protected groupState(role: Role, group: PermissionGroup): 'none' | 'some' | 'all' {
    const count = group.permissions.filter((p) => this.has(role, p.name)).length;
    if (count === 0) return 'none';
    return count === group.permissions.length ? 'all' : 'some';
  }

  protected toggle(role: Role, permission: string): void {
    this.set(role, [permission], !this.has(role, permission));
  }

  protected toggleGroup(role: Role, group: PermissionGroup): void {
    this.set(
      role,
      group.permissions.map((p) => p.name),
      this.groupState(role, group) !== 'all',
    );
  }

  protected isLocked(role: Role): boolean {
    return role.is_system || !this.canEdit() || this.saving();
  }

  protected discard(): void {
    this.grants.set(this.original());
  }

  protected save(): void {
    const dirty = this.dirtyRoles();
    if (!dirty.length) return;

    this.saving.set(true);
    this.roleService
      .syncMatrix(
        dirty.map((role) => ({ id: role.id, permissions: [...this.grants().get(role.id)!] })),
      )
      .subscribe({
        next: (roles) => {
          this.saving.set(false);
          this.setRoles(roles);
          this.notify.success(`Permisos actualizados en ${dirty.length} rol(es)`);
          if (this.auth.user()?.roles.some((r) => dirty.some((d) => d.id === r.id)))
            this.auth.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.notify.error(err.error?.message ?? 'No se pudieron guardar los permisos');
        },
      });
  }

  /** Para el canDeactivate de la ruta: avisa si hay cambios sin guardar. */
  canLeave(): boolean {
    return !this.dirtyRoles().length || confirm('Hay cambios sin guardar. ¿Salir de todos modos?');
  }

  private set(role: Role, permissions: string[], add: boolean): void {
    if (this.isLocked(role)) return;
    this.grants.update((grants) => {
      const next = new Set(grants.get(role.id));
      for (const p of permissions) {
        if (add) next.add(p);
        else next.delete(p);
      }
      return new Map(grants).set(role.id, next);
    });
  }

  private setRoles(roles: Role[]): void {
    const grants: Grants = new Map(roles.map((r) => [r.id, new Set(r.permissions)]));
    this.roles.set(roles);
    this.original.set(grants);
    this.grants.set(grants);
  }
}
