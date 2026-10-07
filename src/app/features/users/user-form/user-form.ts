import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Role, SUPER_ADMIN_ROLE } from '../../../core/models/role';
import { UserPayload } from '../../../core/models/user';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService } from '../../../core/services/role.service';
import { UserService } from '../../../core/services/user.service';

type Field = 'name' | 'email' | 'password' | 'password_confirmation';

/** Valida que password y password_confirmation coincidan. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('password_confirmation')?.value;
  return password && password !== confirmation ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit {
  private readonly users = inject(UserService);
  private readonly roleService = inject(RoleService);
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);

  /** Viene del parámetro de ruta :id (withComponentInputBinding). Sin id = crear. */
  readonly id = input<string>();

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', Validators.minLength(8)],
      password_confirmation: [''],
    },
    { validators: passwordsMatch },
  );

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isEdit = signal(false);

  // --- Roles (solo con permiso roles.assign) ---
  protected readonly canAssignRoles = this.auth.can('roles.assign');
  protected readonly roles = signal<Role[]>([]);
  protected readonly selectedRoles = signal<ReadonlySet<number>>(new Set());
  private readonly isSelf = computed(() => this.userId() === this.auth.user()?.id);

  ngOnInit(): void {
    const id = this.userId();
    this.isEdit.set(id !== null);

    if (this.canAssignRoles) {
      this.roleService.list().subscribe({
        next: (roles) => this.roles.set(roles),
        error: () => this.notify.error('No se pudieron cargar los roles'),
      });
    }

    if (id === null) {
      this.form.controls.password.addValidators(Validators.required);
      return;
    }

    this.loading.set(true);
    this.users.get(id).subscribe({
      next: (user) => {
        this.form.patchValue({ name: user.name, email: user.email });
        this.selectedRoles.set(new Set(user.roles?.map((r) => r.id)));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          err.status === 404 ? 'El usuario no existe' : 'No se pudo cargar el usuario',
        );
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.userId();
    const payload: UserPayload = this.form.getRawValue();
    if (this.canAssignRoles) payload.roles = [...this.selectedRoles()];
    const request$ = id === null ? this.users.create(payload) : this.users.update(id, payload);

    this.saving.set(true);
    request$.subscribe({
      next: (user) => {
        // Sus datos, roles o permisos pueden haber cambiado
        if (user.id === this.auth.user()?.id) this.auth.refresh();
        this.notify.success(
          id === null ? `Usuario ${user.name} creado` : `Usuario ${user.name} actualizado`,
        );
        this.router.navigate(['/users']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 422) {
          this.applyServerErrors(err.error?.errors ?? {});
        } else {
          this.notify.error(err.error?.message ?? 'No se pudo guardar el usuario');
        }
      },
    });
  }

  protected toggleRole(id: number): void {
    this.selectedRoles.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * El rol Administrador solo lo asigna o quita otro Administrador,
   * y nadie puede quitárselo a sí mismo (para no quedarse sin acceso).
   */
  protected roleLockedReason(role: Role): string | null {
    if (role.name !== SUPER_ADMIN_ROLE) return null;
    if (!this.auth.isSuperAdmin()) return 'Solo un Administrador puede asignar este rol';
    if (this.isSelf() && this.selectedRoles().has(role.id)) return 'No puedes quitarte este rol';
    return null;
  }

  /** Primer mensaje de error a mostrar para un campo (cliente o servidor). */
  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (
      field === 'password_confirmation' &&
      control.touched &&
      this.form.hasError('passwordMismatch')
    ) {
      return 'Las contraseñas no coinciden';
    }
    if (!control.touched || !control.errors) return null;

    const errors = control.errors;
    if (errors['server']) return errors['server'];
    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['email']) return 'Ingresa un email válido';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Valor inválido';
  }

  private userId(): number | null {
    const id = Number(this.id());
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private applyServerErrors(errors: Record<string, string[]>): void {
    for (const [field, messages] of Object.entries(errors)) {
      const control = this.form.get(field);
      if (!control) {
        this.notify.error(messages[0]);
        continue;
      }
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
    }
  }
}
