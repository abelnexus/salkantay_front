/** Nombre del rol con acceso total (no editable ni eliminable). */
export const SUPER_ADMIN_ROLE = 'Administrador';

export interface Role {
  id: number;
  name: string;
  description: string | null;
  /** true para el rol Administrador. */
  is_system: boolean;
  permissions: string[];
  users_count: number;
  created_at: string;
  updated_at: string;
}

export interface RolePayload {
  name: string;
  description: string | null;
  permissions: string[];
}

/** Catálogo de permisos agrupado por módulo (`GET /permissions`). */
export interface PermissionGroup {
  module: string;
  label: string;
  permissions: { name: string; label: string }[];
}
