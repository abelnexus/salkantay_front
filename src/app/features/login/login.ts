import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (user) => {
        console.log('Usuario desde el backend:', user);
        this.router.navigate(['/me']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.errorMessage(err));
      },
    });
  }

  private errorMessage(err: HttpErrorResponse): string {
    if (err.status === 422) return err.error?.errors?.email?.[0] ?? 'Datos inválidos';
    if (err.status === 429) return 'Demasiados intentos. Espera un minuto.';
    if (err.status === 0) return 'No se pudo conectar con la API';
    return 'Ocurrió un error inesperado';
  }
}
