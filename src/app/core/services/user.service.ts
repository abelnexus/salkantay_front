import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Paginated } from '../models/paginated';
import { User, UserPayload } from '../models/user';

export type UserSort = 'id' | 'name' | 'email' | 'created_at';
export type SortDirection = 'asc' | 'desc';

/**
 * Selección para acciones masivas:
 * ids concretos, o todos los resultados del filtro actual menos `except`.
 */
export type UserSelection =
  { ids: number[] } | { all: true; search: string; role: number | null; except: number[] };

export interface BulkDeleteResult {
  deleted: number;
  skipped_self: boolean;
  /** Administradores omitidos porque quien elimina no es Administrador. */
  skipped_protected: number;
}

export interface UserQuery {
  page: number;
  per_page: number;
  search: string;
  /** Filtra por id de rol; null = todos. */
  role: number | null;
  sort: UserSort;
  direction: SortDirection;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  list(query: UserQuery): Observable<Paginated<User>> {
    const params: Record<string, string | number> = {
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      direction: query.direction,
    };
    if (query.search) params['search'] = query.search;
    if (query.role !== null) params['role'] = query.role;

    return this.api.get<Paginated<User>>('users', params);
  }

  get(id: number): Observable<User> {
    return this.api.get<User>(`users/${id}`);
  }

  create(payload: UserPayload): Observable<User> {
    return this.api.post<User>('users', payload);
  }

  update(id: number, payload: UserPayload): Observable<User> {
    return this.api.put<User>(`users/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`users/${id}`);
  }

  bulkDelete(selection: UserSelection): Observable<BulkDeleteResult> {
    return this.api.post<BulkDeleteResult>('users/bulk-delete', selection);
  }

  bulkVerify(selection: UserSelection, verified: boolean): Observable<{ updated: number }> {
    return this.api.post<{ updated: number }>('users/bulk-verify', { ...selection, verified });
  }

  /** Descarga un CSV con la selección, en el orden indicado. */
  export(selection: UserSelection, sort: UserSort, direction: SortDirection): Observable<Blob> {
    return this.api.download('users/export', { ...selection, sort, direction });
  }
}
