import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guards';
import type { PermissionMatrix } from './features/roles/permission-matrix/permission-matrix';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'me' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'me',
    canActivate: [authGuard],
    loadComponent: () => import('./features/me/me').then((m) => m.Me),
  },
  {
    path: 'users',
    children: [
      {
        path: '',
        canActivate: [permissionGuard('users.view')],
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
      },
      {
        path: 'new',
        canActivate: [permissionGuard('users.create')],
        loadComponent: () => import('./features/users/user-form/user-form').then((m) => m.UserForm),
      },
      {
        path: ':id/edit',
        canActivate: [permissionGuard('users.update')],
        loadComponent: () => import('./features/users/user-form/user-form').then((m) => m.UserForm),
      },
    ],
  },
  {
    path: 'roles',
    children: [
      {
        path: '',
        canActivate: [permissionGuard('roles.view')],
        loadComponent: () => import('./features/roles/role-list/role-list').then((m) => m.RoleList),
      },
      {
        path: 'matrix',
        canActivate: [permissionGuard('roles.view')],
        canDeactivate: [(matrix: PermissionMatrix) => matrix.canLeave()],
        loadComponent: () =>
          import('./features/roles/permission-matrix/permission-matrix').then(
            (m) => m.PermissionMatrix,
          ),
      },
      {
        path: 'new',
        canActivate: [permissionGuard('roles.create')],
        loadComponent: () => import('./features/roles/role-form/role-form').then((m) => m.RoleForm),
      },
      {
        path: ':id/edit',
        canActivate: [permissionGuard('roles.view')],
        loadComponent: () => import('./features/roles/role-form/role-form').then((m) => m.RoleForm),
      },
    ],
  },
  { path: '**', redirectTo: 'me' },
];
