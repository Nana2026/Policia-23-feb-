# ISSP Dashboard — Backend API

API REST para el Dashboard Operativo del Instituto Superior de Seguridad Pública.

## Stack

| Capa         | Tecnología            |
|--------------|-----------------------|
| Runtime      | Node.js 18+           |
| Framework    | Express 4             |
| ORM          | Prisma 5              |
| Base de datos| PostgreSQL 14+        |
| Auth         | JWT (jsonwebtoken)    |
| Passwords    | bcryptjs              |

---

## Setup rápido

### 1. Requisitos previos

- Node.js ≥ 18
- PostgreSQL corriendo localmente (o en Docker)
- npm o yarn

### 2. Instalar dependencias

```bash
cd issp-backend
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tu DATABASE_URL y JWT_SECRET
```

Ejemplo de DATABASE_URL:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/issp_dashboard"
```

### 4. Crear base de datos

```bash
# Opción A: migrate (recomendado para desarrollo)
npm run db:migrate

# Opción B: push directo (sin historial de migraciones)
npm run db:push
```

### 5. Generar Prisma client

```bash
npm run db:generate
```

### 6. Cargar datos iniciales

```bash
npm run db:seed
```

Usuarios creados:

| Email                    | Password      | Rol       |
|--------------------------|---------------|-----------|
| admin@issp.edu.ar        | Admin2026!    | admin     |
| garcia@issp.edu.ar       | Operador2026! | operador  |
| martinez@issp.edu.ar     | Operador2026! | operador  |

### 7. Iniciar el servidor

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start
```

El servidor corre en **http://localhost:3001**

---

## Endpoints

### Autenticación

```
POST   /api/auth/login       → { token, usuario }
GET    /api/auth/me          → usuario actual (requiere token)
```

### Dashboard

```
GET    /api/dashboard/resumen      → conteos por módulo
GET    /api/dashboard/prioridades  → alertas del día
GET    /api/dashboard/criticos     → lista de elementos críticos
```

### Módulos operativos

Todos requieren `Authorization: Bearer <token>`

```
GET    /api/dormitorios
GET    /api/dormitorios/:id
PATCH  /api/dormitorios/:id
DELETE /api/dormitorios/:id        (solo admin)

GET    /api/aulas
GET    /api/aulas/edificios        → estructura jerárquica para la grilla
GET    /api/aulas/:id
PATCH  /api/aulas/:id
DELETE /api/aulas/:id              (solo admin)

GET    /api/espacios
GET    /api/espacios/:id
PATCH  /api/espacios/:id

GET    /api/arboles
GET    /api/arboles/:id
PATCH  /api/arboles/:id

GET    /api/art
GET    /api/art/:id
PATCH  /api/art/:id
```

### Historial

```
GET    /api/historial?entidad_tipo=aula&entidad_id=1
GET    /api/historial/:entidad/:id
```

### Usuarios (solo admin)

```
GET    /api/usuarios
POST   /api/usuarios
PATCH  /api/usuarios/:id
```

---

## Parámetros de query (filtros)

Todos los endpoints de listado soportan:

| Parámetro        | Valores                         | Descripción                      |
|------------------|---------------------------------|----------------------------------|
| `estado`         | `rojo`, `amarillo`, `verde`     | Filtrar por estado frontend       |
| `q`              | texto                           | Búsqueda por nombre               |
| `orden`          | `prioridad`, `revision`, `nombre` | Orden de resultados             |
| `page`           | número                          | Página (default: 1)               |
| `limit`          | número (max 100)                | Elementos por página (default: 50)|
| `solo_criticos`  | `true`                          | Solo elementos críticos           |
| `revision_vencida`| `true`                         | Revisión hace más de 30 días      |

ART además soporta:

| Parámetro       | Descripción                         |
|-----------------|-------------------------------------|
| `alta_proxima`  | Altas estimadas en los próximos 7 días |
| `prolongados`   | Casos con más de 60 días de inicio  |

---

## Body del PATCH

```json
{
  "estado_general":     "critico",
  "observacion_actual": "Acción en curso",
  "revision_fecha":     "2026-04-11",
  "indicadores": [
    { "tipo": "electricidad", "estado": "critico" },
    { "tipo": "filtraciones", "estado": "operativo" }
  ],
  "observacion_cambio": "Nota que queda en el historial"
}
```

Todos los campos son opcionales — solo se actualiza lo que se envía.

---

## Roles y permisos

| Acción                         | Admin | Operador |
|--------------------------------|-------|----------|
| Ver todos los módulos           | ✓     | ✓        |
| Editar estado y observaciones   | ✓     | ✓        |
| Actualizar indicadores          | ✓     | ✓        |
| Desactivar registros (DELETE)   | ✓     | ✗        |
| Administrar usuarios            | ✓     | ✗        |
| Ver historial completo          | ✓     | ✓        |

---

## Estructura del proyecto

```
issp-backend/
├── prisma/
│   ├── schema.prisma      # Modelo de datos completo
│   └── seed.js            # Datos iniciales (20 dormis, 100 aulas, etc.)
├── src/
│   ├── index.js           # Entry point Express
│   ├── db.js              # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.js        # JWT verification + soloAdmin
│   │   └── audit.js       # Registro de historial
│   ├── routes/
│   │   ├── auth.js        # Login / me
│   │   ├── dashboard.js   # Resumen / prioridades / críticos
│   │   ├── dormitorios.js
│   │   ├── aulas.js
│   │   ├── modulos.js     # Espacios + Árboles + ART
│   │   ├── historial.js
│   │   └── usuarios.js
│   └── utils/
│       ├── transform.js   # DB record → frontend shape
│       └── filtros.js     # Helpers de query / paginación
├── .env.example
├── package.json
└── README.md
```

---

## Docker (opcional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: issp_dashboard
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

```bash
docker compose up -d
```

---

## Próximos pasos sugeridos

1. **Rate limiting** — agregar `express-rate-limit` en los endpoints de auth
2. **Refresh tokens** — para sesiones más largas
3. **Notificaciones** — WebSocket o polling para alertas en tiempo real
4. **Exportación** — endpoint `/api/aulas/export.csv`
5. **Tests** — Jest + Supertest para endpoints críticos
