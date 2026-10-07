import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Agrega el token Bearer a las peticiones hacia la API.
 * Si la API responde 401 (token inválido o revocado), cierra la sesión local.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;

  const authReq = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token) {
        auth.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
