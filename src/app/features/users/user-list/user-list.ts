import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Paginated } from '../../../core/models/paginated';
import { Role, SUPER_ADMIN_ROLE } from '../../../core/models/role';
import { User } from '../../../core/models/user';
import { RoleService } from '../../../core/services/role.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  SortDirection,
  UserQuery,
  UserSelection,
  UserService,
  UserSort,
} from '../../../core/services/user.service';
import { saveFile } from '../../../core/utils/save-file';

const PER_PAGE_OPTIONS = [5, 10, 25, 50, 100];
const SORTABLE: UserSort[] = ['id', 'name', 'email', 'created_at'];
const DEFAULT_QUERY: UserQuery = {
  page: 1,
  per_page: 10,
  search: '',
  role: null,
  sort: 'id',
  direction: 'desc',
};

/** Lee los filtros desde la URL (?page=2&per_page=25&search=ana&role=3&sort=name&direction=asc). */
function parseQuery(params: ParamMap): UserQuery {
  const page = Number(params.get('page'));
  const perPage = Number(params.get('per_page'));
  const sort = params.get('sort') as UserSort;
  const direction = params.get('direction');
  const role = Number(params.get('role'));

  return {
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_QUERY.page,
    per_page: PER_PAGE_OPTIONS.includes(perPage) ? perPage : DEFAULT_QUERY.per_page,
    search: params.get('search') ?? DEFAULT_QUERY.search,
    role: Number.isInteger(role) && role > 0 ? role : DEFAULT_QUERY.role,
    sort: SORTABLE.includes(sort) ? sort : DEFAULT_QUERY.sort,
    direction: direction === 'asc' || direction === 'desc' ? direction : DEFAULT_QUERY.direction,
  };
}

@Component({
  selector: 'app-user-list',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly users = inject(UserService);
  private readonly notify = inject(NotificationService);
  private readonly roleService = inject(RoleService);
  protected readonly auth = inject(AuthService);

  protected readonly perPageOptions = PER_PAGE_OPTIONS;
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly query = toSignal(this.route.queryParamMap.pipe(map(parseQuery)), {
    initialValue: DEFAULT_QUERY,
  });
  protected readonly result = signal<Paginated<User> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deletingId = signal<number | null>(null);
  /** Roles para el filtro (solo si el usuario puede listarlos). */
  protected readonly roles = signal<Role[]>([]);
  protected readonly selectedRoleName = computed(
    () => this.roles().find((r) => r.id === this.query().role)?.name ?? null,
  );

  // --- Selección ---
  // Modo normal: `picked` = ids marcados.
  // Modo "todos los resultados" (selectAll): `picked` = ids desmarcados (excepciones).
  protected readonly selectAll = signal(false);
  protected readonly picked = signal<ReadonlySet<number>>(new Set());
  /** Acción masiva en curso ('export', 'delete', ...) para deshabilitar botones. */
  protected readonly bulkBusy = signal<string | null>(null);

  protected readonly selectedCount = computed(() => {
    const total = this.result()?.total ?? 0;
    return this.selectAll() ? total - this.picked().size : this.picked().size;
  });

  /** Estado del checkbox del encabezado según las filas de la página actual. */
  protected readonly pageSelection = computed<'none' | 'some' | 'all'>(() => {
    const rows = this.result()?.data ?? [];
    const selected = rows.filter((u) => this.isSelected(u.id)).length;
    if (selected === 0) return 'none';
    return selected === rows.length ? 'all' : 'some';
  });

  /** Hasta 5 números de página alrededor de la actual. */
  protected readonly pages = computed(() => {
    const res = this.result();
    if (!res) return [];
    const start = Math.max(1, Math.min(res.current_page - 2, res.last_page - 4));
    const end = Math.min(res.last_page, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  private readonly reload$ = new Subject<void>();
  private lastFilter: string | null = null;

  constructor() {
    combineLatest([
      this.route.queryParamMap.pipe(map(parseQuery)),
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(([query]) => {
          this.loading.set(true);
          this.error.set(null);
          this.searchControl.setValue(query.search, { emitEvent: false });
          // Al cambiar la búsqueda o el rol, la selección anterior deja de tener sentido
          const filter = `${query.search}|${query.role}`;
          if (filter !== this.lastFilter) {
            this.lastFilter = filter;
            this.clearSelection();
          }
        }),
        switchMap(([query]) =>
          this.users.list(query).pipe(
            catchError(() => {
              this.error.set('No se pudo cargar la lista de usuarios');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        // Si la página pedida ya no existe (p. ej. tras eliminar), ir a la última
        if (res.current_page > res.last_page && res.last_page > 0) {
          this.updateQuery({ page: res.last_page });
          return;
        }
        this.result.set(res);
      });

    this.searchControl.valueChanges
      .pipe(
        debounceTime(350),
        map((v) => v.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((search) => this.updateQuery({ search, page: 1 }));

    if (this.auth.can('roles.view', 'roles.assign')) {
      this.roleService.list().subscribe({ next: (roles) => this.roles.set(roles) });
    }
  }

  protected changeRole(value: string): void {
    this.updateQuery({ role: value ? Number(value) : null, page: 1 });
  }

  /** Un usuario que no es Administrador no puede editar ni eliminar a uno que sí lo es. */
  protected isProtected(user: User): boolean {
    return !this.auth.isSuperAdmin() && !!user.roles?.some((r) => r.name === SUPER_ADMIN_ROLE);
  }

  protected goToPage(page: number): void {
    const last = this.result()?.last_page ?? 1;
    if (page < 1 || page > last || page === this.query().page) return;
    this.updateQuery({ page });
  }

  protected changePerPage(value: string): void {
    this.updateQuery({ per_page: Number(value), page: 1 });
  }

  protected sortBy(column: UserSort): void {
    const { sort, direction } = this.query();
    const next: SortDirection = sort === column && direction === 'asc' ? 'desc' : 'asc';
    this.updateQuery({ sort: column, direction: next, page: 1 });
  }

  protected sortIcon(column: UserSort): string {
    const { sort, direction } = this.query();
    if (sort !== column) return '↕';
    return direction === 'asc' ? '↑' : '↓';
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
  }

  protected remove(user: User): void {
    if (!confirm(`¿Eliminar a ${user.name} (${user.email})? Esta acción no se puede deshacer.`))
      return;

    this.deletingId.set(user.id);
    this.users.delete(user.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.notify.success(`Usuario ${user.name} eliminado`);
        if (!this.selectAll()) this.picked.update((set) => withToggled(set, [user.id], false));
        this.reload$.next();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        this.notify.error(err.error?.message ?? 'No se pudo eliminar el usuario');
      },
    });
  }

  // --- Selección ---

  protected isSelected(id: number): boolean {
    return this.selectAll() !== this.picked().has(id);
  }

  protected toggle(id: number): void {
    this.picked.update((set) => withToggled(set, [id], !set.has(id)));
    if (this.selectAll() && this.selectedCount() === 0) this.clearSelection();
  }

  /** Marca o desmarca todas las filas de la página actual. */
  protected togglePage(): void {
    const ids = (this.result()?.data ?? []).map((u) => u.id);
    const select = this.pageSelection() !== 'all';
    // En modo "todos", seleccionar = quitar de las excepciones
    this.picked.update((set) => withToggled(set, ids, select !== this.selectAll()));
  }

  protected selectAllResults(): void {
    this.selectAll.set(true);
    this.picked.set(new Set());
  }

  protected clearSelection(): void {
    this.selectAll.set(false);
    this.picked.set(new Set());
  }

  // --- Acciones masivas ---

  /** Exporta la selección, o todos los resultados del filtro actual. */
  protected exportCsv(scope: 'selection' | 'results'): void {
    const selection: UserSelection =
      scope === 'results'
        ? { all: true, search: this.query().search, role: this.query().role, except: [] }
        : this.currentSelection();
    const { sort, direction } = this.query();

    this.bulkBusy.set('export');
    this.users.export(selection, sort, direction).subscribe({
      next: (blob) => {
        this.bulkBusy.set(null);
        saveFile(blob, `usuarios-${new Date().toISOString().slice(0, 10)}.csv`);
      },
      error: () => {
        this.bulkBusy.set(null);
        this.notify.error('No se pudo exportar');
      },
    });
  }

  protected bulkVerify(verified: boolean): void {
    this.runBulk(
      verified ? 'verify' : 'unverify',
      this.users.bulkVerify(this.currentSelection(), verified),
      (res) =>
        this.notify.success(
          `${res.updated} usuario(s) marcados como ${verified ? 'verificados' : 'no verificados'}`,
        ),
    );
  }

  protected bulkDelete(): void {
    const count = this.selectedCount();
    if (!confirm(`¿Eliminar ${count} usuario(s)? Esta acción no se puede deshacer.`)) return;

    this.runBulk('delete', this.users.bulkDelete(this.currentSelection()), (res) => {
      this.clearSelection();
      if (res.deleted > 0) this.notify.success(`${res.deleted} usuario(s) eliminados`);
      if (res.skipped_self) this.notify.error('Tu propio usuario no se eliminó');
      if (res.skipped_protected > 0) {
        this.notify.error(
          `${res.skipped_protected} administrador(es) no se eliminaron: solo otro Administrador puede hacerlo`,
        );
      }
    });
  }

  private runBulk<T>(action: string, request$: Observable<T>, onSuccess: (res: T) => void): void {
    this.bulkBusy.set(action);
    request$.subscribe({
      next: (res) => {
        this.bulkBusy.set(null);
        onSuccess(res);
        this.reload$.next();
      },
      error: (err: HttpErrorResponse) => {
        this.bulkBusy.set(null);
        this.notify.error(err.error?.message ?? 'No se pudo completar la acción');
      },
    });
  }

  private currentSelection(): UserSelection {
    const ids = [...this.picked()];
    const { search, role } = this.query();
    return this.selectAll() ? { all: true, search, role, except: ids } : { ids };
  }

  /** Cambia los filtros en la URL; omite los valores por defecto para que quede limpia. */
  private updateQuery(changes: Partial<UserQuery>): void {
    const next = { ...this.query(), ...changes };
    const queryParams = Object.fromEntries(
      Object.entries(next).map(([key, value]) => [
        key,
        value === DEFAULT_QUERY[key as keyof UserQuery] ? null : value,
      ]),
    );
    this.router.navigate([], { relativeTo: this.route, queryParams });
  }
}

/** Devuelve un nuevo Set con `ids` agregados (add = true) o quitados. */
function withToggled(set: ReadonlySet<number>, ids: number[], add: boolean): Set<number> {
  const next = new Set(set);
  for (const id of ids) {
    if (add) next.add(id);
    else next.delete(id);
  }
  return next;
}
