import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Servicio base para hablar con la API de Laravel.
 * Los servicios de cada recurso (ej. ProductService) lo usan:
 *   this.api.get<Product[]>('products')  ->  GET http://localhost:8081/api/products
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: HttpParams | Record<string, string | number>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${path}`, { params });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`);
  }

  /** POST que devuelve un archivo (CSV, PDF, etc.) en lugar de JSON. */
  download(path: string, body: unknown): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/${path}`, body, { responseType: 'blob' });
  }
}
