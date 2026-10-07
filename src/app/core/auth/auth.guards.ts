import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from './auth.service';

/** Solo deja pasar a usuarios autenticados; si no, manda a /login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadUser().pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};

/** Evita que un usuario ya autenticado vuelva a ver el login. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.loadUser().pipe(map((user) => (user ? router.createUrlTree(['/me']) : true)));
};

/**
 * Exige sesión y al menos uno de los permisos indicados.
 * Uso: `canActivate: [permissionGuard('users.view')]`
 */
export function permissionGuard(...permissions: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const notify = inject(NotificationService);
    return auth.loadUser().pipe(
      map((user) => {
        if (!user) return router.createUrlTree(['/login']);
        if (auth.can(...permissions)) return true;
        notify.error('No tienes permiso para ver esa sección');
        return router.createUrlTree(['/me']);
      }),
    );
  };
}
