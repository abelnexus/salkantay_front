# Salkantay — Frontend

Interfaz web del sistema Salkantay: inicio de sesión, gestión de usuarios y roles/permisos.

| Repositorio | Stack | URL local |
| --- | --- | --- |
| [salkantay_back](https://github.com/abelnexus/salkantay_back) | Laravel 13 · PHP 8.4-FPM · Nginx · MySQL 8.4 | http://localhost:8081/api |
| **salkantay_front** (este) | Angular 22 · Node 22 | http://localhost:4200 |

El sistema completo necesita **los dos repositorios corriendo a la vez**. El front consume la API en `http://localhost:8081/api` (configurado en `src/environments/`).

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye Docker Compose)
- Git

No hace falta instalar PHP, Composer, Node ni MySQL: todo corre dentro de contenedores.

Puertos que deben estar libres: **8081** (API), **3307** (MySQL), **4200** (front).

---

## Cómo levantar el sistema completo

### 1. Clonar ambos repositorios

```bash
git clone https://github.com/abelnexus/salkantay_back.git
git clone https://github.com/abelnexus/salkantay_front.git
```

### 2. Backend

```bash
cd salkantay_back
cp .env.example .env
docker compose up -d --build

# Solo la primera vez:
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

> Si `migrate` falla con *Connection refused*, MySQL aún está arrancando: espera unos segundos y vuelve a ejecutarlo.

Comprobar que responde: http://localhost:8081/api/health

### 3. Frontend

```bash
cd ../salkantay_front
docker compose up -d --build
```

La primera vez tarda un poco (instala dependencias y compila). Ver el avance con `docker compose logs -f front`.

### 4. Entrar

Abrir **http://localhost:4200** e iniciar sesión con el usuario creado por el seeder:

| Email | Contraseña | Rol |
| --- | --- | --- |
| `test@example.com` | `password` | Administrador (acceso total) |

---

## Sin Docker (opcional)

Con Node 22 instalado localmente, y el backend ya corriendo:

```bash
npm install
npm start          # http://localhost:4200
```

## Tests

```bash
docker compose exec front npx ng test --watch=false
```

## Comandos útiles

```bash
docker compose ps                 # qué está corriendo
docker compose logs -f front      # logs en vivo
docker compose down               # apagar
docker compose up -d --build      # reconstruir (p. ej. tras cambiar package.json)
```
