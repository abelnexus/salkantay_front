import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas compartidas por la lista de roles y la matriz de permisos. */
@Component({
  selector: 'app-roles-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Secciones de roles y permisos">
      <a routerLink="/roles" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
        >Roles</a
      >
      <a routerLink="/roles/matrix" routerLinkActive="active">Matriz de permisos</a>
    </nav>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 1px solid #e5e5e5;
    }

    a {
      margin-bottom: -1px;
      padding: 8px 14px;
      border-bottom: 2px solid transparent;
      color: #6b7280;
      text-decoration: none;
      font-size: 0.9rem;

      &:hover {
        color: #1f2937;
      }
      &.active {
        border-color: #1f2937;
        color: #1f2937;
        font-weight: 600;
      }
    }
  `,
})
export class RolesTabs {}
