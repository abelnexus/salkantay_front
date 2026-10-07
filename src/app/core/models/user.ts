/** Rol tal como viene anidado en un usuario. */
export interface RoleSummary {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  roles?: RoleSummary[];
}

/** Usuario en sesión (`/me` y login): incluye sus permisos efectivos. */
export interface AuthUser extends User {
  roles: RoleSummary[];
  permissions: string[];
}

/** Datos para crear/editar. En edición, password vacío = no cambiarla. Sin `roles` = no tocarlos. */
export interface UserPayload {
  name: string;
  email: string;
  password?: string;
  password_confirmation?: string;
  roles?: number[];
}
