import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PermissionGroup, Role, RolePayload } from '../models/role';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);

  list(): Observable<Role[]> {
    return this.api.get<Role[]>('roles');
  }

  get(id: number): Observable<Role> {
    return this.api.get<Role>(`roles/${id}`);
  }

  create(payload: RolePayload): Observable<Role> {
    return this.api.post<Role>('roles', payload);
  }

  update(id: number, payload: RolePayload): Observable<Role> {
    return this.api.put<Role>(`roles/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`roles/${id}`);
  }

  permissions(): Observable<PermissionGroup[]> {
    return this.api.get<PermissionGroup[]>('permissions');
  }

  /** Guarda de una vez los permisos de varios roles (matriz). Devuelve la lista actualizada. */
  syncMatrix(roles: { id: number; permissions: string[] }[]): Observable<Role[]> {
    return this.api.put<Role[]>('roles/permissions', { roles });
  }
}
