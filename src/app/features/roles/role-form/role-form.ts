import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionGroup, Role, RolePayload } from '../../../core/models/role';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';

type Field = 'name' | 'description';

@Component({
  selector: 'app-role-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
})
export class RoleForm implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  /** Viene del parámetro de ruta :id (withComponentInputBinding). Sin id = crear. */
  readonly id = input<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(255)],
  });

  protected readonly groups = signal<PermissionGroup[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly role = signal<Role | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly permissionsError = signal<string | null>(null);

  protected readonly isEdit = computed(() => this.roleId() !== null);
  /** Solo lectura: rol del sistema, o sin permiso para editar. */
  protected readonly readonly = computed(
    () => this.role()?.is_system === true || (this.isEdit() && !this.auth.can('roles.update')),
  );
  protected readonly totalPermissions = computed(() =>
    this.groups().reduce((sum, g) => sum + g.permissions.length, 0),
  );

  ngOnInit(): void {
    const id = this.roleId();

    forkJoin([
      this.roleService.permissions(),
      id === null ? of(null) : this.roleService.get(id),
    ]).subscribe({
      next: ([groups, role]) => {
        this.groups.set(groups);
        if (role) {
          this.role.set(role);
          this.form.patchValue({ name: role.name, description: role.description ?? '' });
          this.selected.set(new Set(role.permissions));
        }
        if (this.readonly()) this.form.disable();
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(err.status === 404 ? 'El rol no existe' : 'No se pudo cargar el rol');
      },
    });
  }

  protected isChecked(permission: string): boolean {
    return this.selected().has(permission);
  }

  /** Estado del checkbox de un módulo según sus permisos marcados. */
  protected groupState(group: PermissionGroup): 'none' | 'some' | 'all' {
    const count = group.permissions.filter((p) => this.selected().has(p.name)).length;
    if (count === 0) return 'none';
    return count === group.permissions.length ? 'all' : 'some';
  }

  protected toggle(permission: string): void {
    this.setPermissions([permission], !this.selected().has(permission));
  }

  protected toggleGroup(group: PermissionGroup): void {
    this.setPermissions(
      group.permissions.map((p) => p.name),
      this.groupState(group) !== 'all',
    );
  }

  protected toggleAll(): void {
    const all = this.groups().flatMap((g) => g.permissions.map((p) => p.name));
    this.setPermissions(all, this.selected().size < all.length);
  }

  protected submit(): void {
    if (this.readonly()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.roleId();
    const { name, description } = this.form.getRawValue();
    const payload: RolePayload = {
      name: name.trim(),
      description: description.trim() || null,
      permissions: [...this.selected()],
    };
    const request$ =
      id === null ? this.roleService.create(payload) : this.roleService.update(id, payload);

    this.saving.set(true);
    this.permissionsError.set(null);
    request$.subscribe({
      next: (role) => {
        // Si el usuario actual tiene este rol, sus permisos cambiaron
        if (this.auth.user()?.roles.some((r) => r.id === role.id)) this.auth.refresh();
        this.notify.success(
          id === null ? `Rol ${role.name} creado` : `Rol ${role.name} actualizado`,
        );
        this.router.navigate(['/roles']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 422) {
          this.applyServerErrors(err.error?.errors ?? {});
        } else {
          this.notify.error(err.error?.message ?? 'No se pudo guardar el rol');
        }
      },
    });
  }

  /** Primer mensaje de error a mostrar para un campo (cliente o servidor). */
  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) return null;

    const errors = control.errors;
    if (errors['server']) return errors['server'];
    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Valor inválido';
  }

  private setPermissions(names: string[], add: boolean): void {
    if (this.readonly()) return;
    this.selected.update((set) => {
      const next = new Set(set);
      for (const name of names) {
        if (add) next.add(name);
        else next.delete(name);
      }
      return next;
    });
  }

  private roleId(): number | null {
    const id = Number(this.id());
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private applyServerErrors(errors: Record<string, string[]>): void {
    for (const [field, messages] of Object.entries(errors)) {
      if (field.startsWith('permissions')) {
        this.permissionsError.set(messages[0]);
        continue;
      }
      const control = this.form.get(field);
      if (!control) continue;
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
    }
  }
}
