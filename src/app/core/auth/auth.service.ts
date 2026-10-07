import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthUser } from '../models/user';
import { SUPER_ADMIN_ROLE } from '../models/role';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'salkantay_token';

/**
 * Maneja la sesión con tokens de Sanctum:
 * guarda el token en localStorage y expone el usuario actual como signal.
 * También expone sus permisos para mostrar u ocultar partes de la interfaz
 * (la API vuelve a validarlos en cada petición).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly currentUser = signal<AuthUser | null>(null);
  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isSuperAdmin = computed(
    () => this.currentUser()?.roles.some((r) => r.name === SUPER_ADMIN_ROLE) ?? false,
  );
  private readonly permissions = computed(() => new Set(this.currentUser()?.permissions ?? []));

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<AuthUser> {
    return this.api.post<LoginResponse>('login', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        this.currentUser.set(res.user);
      }),
      map((res) => res.user),
    );
  }

  /** Obtiene el usuario del token guardado (por ejemplo, al recargar la página). */
  loadUser(): Observable<AuthUser | null> {
    if (!this.token) return of(null);
    if (this.currentUser()) return of(this.currentUser());

    return this.api.get<AuthUser>('me').pipe(
      tap((user) => this.currentUser.set(user)),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  /** ¿Tiene alguno de estos permisos? (reactivo: se puede usar en plantillas y computed). */
  can(...permissions: string[]): boolean {
    const granted = this.permissions();
    return permissions.some((p) => granted.has(p));
  }

  /** Vuelve a pedir el usuario en sesión (p. ej. si cambiaron sus datos, roles o permisos). */
  refresh(): void {
    if (!this.token) return;
    this.api.get<AuthUser>('me').subscribe({ next: (user) => this.currentUser.set(user) });
  }

  logout(): void {
    const finish = () => {
      this.clearSession();
      this.router.navigate(['/login']);
    };
    // Aunque el back falle, la sesión local se cierra igual
    this.api.post('logout', {}).subscribe({ next: finish, error: finish });
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
  }
}
