# LISTOCO

Plataforma multiplataforma de apoyo a la vida académica de estudiantes de **Ingeniería Civil Informática de la PUCV**: centraliza la malla curricular, el avance académico, la generación personalizada de horarios, el calendario y los trámites académicos.

| | |
|---|---|
| **Ambiente de staging** | https://listoco-staging-980.mexicocentral.cloudapp.azure.com |
| **Estado de salud (staging)** | https://listoco-staging-980.mexicocentral.cloudapp.azure.com/api/health |
| **Repositorio** | https://github.com/claapii/ProyectoWebAvanzada |
| **Prototipo en Figma** | [Ver prototipo](https://www.figma.com/proto/lDXAUd1pbXqCx57El8fokI/Listoco?node-id=0-1&t=3o8pen7MmLMEIHnp-1) |

---

## Tabla de contenidos

1. [Integrantes y responsabilidades](#1-integrantes-y-responsabilidades)
2. [Problema, usuarios y objetivos](#2-problema-usuarios-y-objetivos)
3. [Alcance y exclusiones](#3-alcance-y-exclusiones)
4. [Funcionalidades](#4-funcionalidades)
5. [Arquitectura](#5-arquitectura)
6. [Tecnologías](#6-tecnologías)
7. [Información obtenida desde la Web](#7-información-obtenida-desde-la-web)
8. [Capacidad adaptativa: generador de horarios](#8-capacidad-adaptativa-generador-de-horarios)
9. [Instalación](#9-instalación)
10. [Variables de entorno y secretos](#10-variables-de-entorno-y-secretos)
11. [Ejecución](#11-ejecución)
12. [Instrucciones de uso](#12-instrucciones-de-uso)
13. [Pruebas](#13-pruebas)
14. [Docker](#14-docker)
15. [Pipeline DevSecOps y despliegue](#15-pipeline-devsecops-y-despliegue)
16. [Infraestructura como código](#16-infraestructura-como-código)
17. [Documentación de la API](#17-documentación-de-la-api)
18. [Seguridad, privacidad y observabilidad](#18-seguridad-privacidad-y-observabilidad)
19. [Documentación adicional y diagramas](#19-documentación-adicional-y-diagramas)
20. [Limitaciones conocidas](#20-limitaciones-conocidas)
21. [Trabajo futuro](#21-trabajo-futuro)
22. [Licencia](#22-licencia)

---

## 1. Integrantes y responsabilidades

| Integrante |
|---|---|
| Benjamin Peredo |
| Ariel Carrasco |
| Diego Valenzuela |

## 2. Problema, usuarios y objetivos

**Problema.** Las gestiones académicas de un estudiante (qué ramos puede tomar, cómo armar un horario sin topes, solicitudes, justificaciones, fechas importantes) están repartidas entre plataformas institucionales, correos y procesos presenciales. Eso genera confusión, pérdida de tiempo y errores al planificar el semestre. Como caso inicial se atiende a estudiantes de **Ingeniería Civil Informática PUCV**.

**Usuarios objetivo**

- **Estudiante** (rol `STUDENT`): usuario principal. Registra su avance, genera horarios, usa el calendario y registra trámites.
- **Administrador** (rol `ADMIN`): ejecuta y supervisa la ingesta de la malla oficial y consulta las corridas de ingesta.

**Objetivo general.** Apoyar la planificación académica de los estudiantes mediante una plataforma multiplataforma que usa información oficial obtenida de la Web y la adapta a la situación y las preferencias de cada estudiante.

**Objetivos específicos**

1. Obtener la malla curricular oficial desde la Web de forma automatizada, responsable y trazable.
2. Proponer horarios sin choques, ordenados según las preferencias de cada estudiante.
3. Entregar la aplicación en navegador y Android desde una base de código común.
4. Construir, probar, proteger, desplegar y monitorear el sistema de forma reproducible (DevSecOps).

## 3. Alcance y exclusiones

**Incluye:** autenticación y roles; malla curricular obtenida desde la fuente oficial; avance académico por estudiante; generador de horarios; calendario; trámites académicos internos; panel de administración; despliegue automático en staging.

**No incluye (exclusiones declaradas):**

- No se inscribe ningún ramo en sistemas de la universidad: la inscripción es **simulada** y la decisión final es siempre del estudiante.
- Los trámites se registran **internamente**; no se envían correos ni solicitudes reales a la universidad.
- No predice rendimiento académico ni usa datos de otros estudiantes.
- Solo cubre Ingeniería Civil Informática PUCV.
- No hay despliegue de producción: el ambiente final es **staging**.

## 4. Funcionalidades

- Registro, inicio de sesión (JWT) y control de acceso por rol.
- **Malla y planificación:** consulta de asignaturas por semestre, categoría o texto, con la procedencia y la fecha de actualización de los datos.
- **Avance académico:** el estudiante marca asignaturas aprobadas/reprobadas; se validan prerrequisitos.
- **Generador de horarios** (capacidad adaptativa): alternativas sin choques, ordenadas por puntaje según jornada, día libre y hora de término preferidos.
- **Calendario** académico y personal, con recordatorios.
- **Trámites académicos:** registro y seguimiento de solicitudes, con documentos adjuntos.
- **Panel administrativo:** ejecución de la ingesta y consulta de corridas con sus métricas de calidad.
- **Estado del sistema:** `/health` con NestJS, PostgreSQL, Python y última ingesta.

## 5. Arquitectura

Flujo principal: **Ionic + Angular + Capacitor → NestJS → (PostgreSQL | FastAPI)**. El frontend solo habla con NestJS; el servicio Python no se publica hacia Internet (solo su `/health`) y NestJS lo invoca por la red interna con una clave de servicio.

```mermaid
flowchart LR
    U[Estudiante / Administrador] --> F["Frontend<br/>Ionic + Angular<br/>(Web, Android con Capacitor)"]
    F -- "HTTPS · REST · JWT" --> N["Backend NestJS<br/>API REST · reglas · auth"]
    N -- "Prisma" --> P[(PostgreSQL)]
    N -- "REST interno<br/>X-Internal-Api-Key<br/>timeout + reintentos" --> Y["Servicio Python<br/>FastAPI<br/>ingesta y procesamiento"]
    Y -- "HTTPS · robots.txt<br/>User-Agent identificado" --> W[("Fuente web<br/>PDF plan de estudios PUCV")]
```

**Flujo de la ingesta (Fuente web → Python → NestJS → PostgreSQL → Angular)**

1. El administrador solicita la ingesta desde la aplicación (`POST /ingestion/curriculum`, rol `ADMIN`).
2. NestJS llama a FastAPI (`POST /ingest/curriculum`) con `X-Internal-Api-Key` y el mismo `X-Request-Id`.
3. Python respeta `robots.txt`, descarga el PDF (con límites de tamaño y tiempo), calcula su SHA-256, extrae las asignaturas, las limpia, normaliza y deduplica, y devuelve datos + procedencia + métricas.
4. NestJS **valida de nuevo** la respuesta (no confía en otro servicio) y guarda en una transacción: asignaturas nuevas, actualizadas, sin cambios y desactivadas, más la corrida (`IngestionRun`) con su procedencia.
5. El estudiante consulta `GET /courses` y la aplicación muestra la malla con su fuente y fecha.

**Resiliencia.** Si Python no responde, NestJS no queda bloqueado: tiempo máximo de espera, hasta 2 reintentos solo para fallos transitorios, y una respuesta comprensible (`503`/`502` con un código como `PYTHON_UNAVAILABLE`, `PYTHON_TIMEOUT`, `SOURCE_UNAVAILABLE`). Los datos ya guardados siguen disponibles y `/health` pasa a `degraded` en lugar de caerse.

**Modelo de datos (Prisma / PostgreSQL).** `User`, `DataSource`, `IngestionRun`, `Course`, `StudentCourseProgress`, `SchedulePreference`, `CourseSection`, `ClassMeeting`, `SavedSchedule`, `SavedScheduleSection`, `CalendarEvent`, `AcademicRequest`, `AcademicRequestAttachment`. Las migraciones están en `backend/prisma/migrations/` y se aplican con `prisma migrate deploy`.

Las decisiones de diseño están en [`docs/architecture/registrodecisionesarquitectonicas.md`](docs/architecture/registrodecisionesarquitectonicas.md) (ADR-001 a ADR-009).

## 6. Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Angular (componentes standalone), TypeScript, Ionic Framework, Angular Router, guards e interceptores |
| Multiplataforma | Capacitor 8 (Android; APK generado por GitHub Actions) |
| Backend principal | NestJS, Node.js 24, TypeScript, class-validator, JWT, bcrypt |
| Persistencia | PostgreSQL 17, Prisma |
| Servicio especializado | Python, FastAPI, extracción de PDF |
| Pruebas | `ng test` / Vitest (frontend), Vitest + supertest (backend), pytest (Python) |
| Contenedores | Docker, Docker Compose, Caddy (HTTPS automático en staging) |
| CI/CD | GitHub Actions, GHCR |
| Seguridad | CodeQL, Gitleaks, `npm audit`, `pip-audit`, Trivy, Ruff, oxlint |
| Infraestructura | Terraform (Azure: VM, red, IP pública), estado remoto en Azure Storage |

## 7. Información obtenida desde la Web

| Pregunta | Respuesta |
|---|---|
| **Fuente** | Plan de estudios oficial de Ingeniería Civil Informática publicado por la PUCV (PDF). URL configurable con `SOURCE_URL`. |
| **Método** | Descarga automatizada y extracción del PDF por su geometría (ADR-007 y ADR-008). |
| **Datos obtenidos** | Código normalizado, nombre, semestre sugerido y categoría de cada asignatura. |
| **Limpieza y normalización** | Normalización de texto y acentos, códigos únicos (*slug*), validación de rango de semestre y largo de campos. |
| **Duplicados** | Se detectan en Python y se vuelven a verificar en NestJS; la ingesta es **idempotente** (repetirla no duplica registros). |
| **Procedencia** | Cada corrida guarda fuente, URL, fecha y hora, SHA-256, tamaño, resolución, versión del extractor y si vino de caché. Cada asignatura apunta a la última corrida que la vio. |
| **Calidad** | Métricas por corrida: candidatos, válidos, rechazados, duplicados, semestres detectados vs. esperados, `coverage`, `validRatio`, duración. |
| **Actualización** | Bajo demanda (administrador). Si el hash no cambia, se informa `changed=false`. Las asignaturas que desaparecen se marcan inactivas, no se borran. |
| **Fuente caída** | Respaldo en caché local del servicio Python y error clasificado (`SOURCE_UNAVAILABLE`). |
| **Uso responsable** | Se respeta `robots.txt`, se usa un *User-Agent* identificado con contacto, hay límites de tamaño y tiempo y una sola descarga por corrida. Solo se extraen datos públicos de la malla. |

> **Prerrequisitos y créditos.** La fuente oficial no los publica. Los prerrequisitos están en `backend/src/academic-progress/prerequisites.ts`, aportados por estudiantes de la carrera y **pendientes de validación institucional**. Se declaran como dato curado, no como dato obtenido de la Web.

## 8. Capacidad adaptativa: generador de horarios

**Qué se adapta.** Las alternativas de horario que ve cada estudiante y su orden.

**A quién.** A cada estudiante, según sus ramos seleccionados y sus preferencias guardadas.

**Variables.** Asignaturas elegidas, secciones y bloques horarios disponibles, jornada preferida (`ANY` / `MORNING` / `AFTERNOON`), día libre deseado, hora máxima de término y máximo de asignaturas.

**Mecanismo.** Algoritmo **determinista de reglas + puntuación** (no usa IA generativa ni aprendizaje automático; ver justificación en `docs/capacidad-adaptativa.md`). Está en `backend/src/schedule-generator/schedule-generator.algorithm.ts`:

1. **Regla dura:** se exploran las combinaciones de una sección por ramo y se **descartan las que tienen choques** de horario (entre ramos y dentro de una misma sección).
2. **Reglas blandas (puntaje):**

| Criterio | Efecto en el puntaje |
|---|---|
| El día libre deseado queda sin clases | +20 |
| Un bloque comienza en la jornada preferida (mañana: antes de las 12:00; tarde: desde las 12:00) | +3 por bloque |
| Un bloque termina después de la hora máxima preferida (por defecto 18:00) | −10 por bloque |

3. Se ordenan por puntaje descendente y se muestran hasta 10 alternativas.

**Decisión visible.** La pantalla *Horarios* muestra cada alternativa con su puntaje. El estudiante puede cambiar sus preferencias y regenerar, elegir una alternativa y guardarla.

**Control del usuario.** Nada se inscribe automáticamente: el estudiante decide qué alternativa guardar, puede cambiar preferencias en cualquier momento y puede ignorar todas las alternativas.

**Verificación y comparación con una línea base.** Con los mismos ramos, se comparan las alternativas con jornada `ANY` (línea base, sin preferencias) contra las obtenidas con jornada `MORNING` o con un día libre. La adaptación es verificable porque cambia el orden y el puntaje sin introducir choques.


| Escenario (mismos ramos) | Alternativas con 0 choques | Mejor puntaje | Día libre logrado |
|---|---|---|---|
| Base: jornada `ANY`, sin día libre | `<!-- n -->` | `<!-- p -->` | No |
| Jornada `MORNING` | `<!-- n -->` | `<!-- p -->` | — |
| Día libre `<!-- día -->` | `<!-- n -->` | `<!-- p -->` | Sí |

**Riesgos de sesgo, privacidad y transparencia**

- Los pesos (+20, +3, −10) son una decisión de diseño **no calibrada con usuarios**; favorecen cumplir el día libre por sobre la jornada.
- Solo se usan datos del propio estudiante, asociados a su cuenta y visibles solo para él.
- La oferta de secciones es de **demostración** (período 2027-1, `isDemo`): el puntaje refleja preferencias, no la disponibilidad real de cupos.

## 9. Instalación

**Requisitos:** Git, Docker Desktop con Docker Compose, Node.js 24, npm, Python 3.14 (la versión de la imagen Docker), `jq` y `curl` (para la prueba de humo) y Terraform (solo para infraestructura).

```bash
git clone https://github.com/claapii/ProyectoWebAvanzada.git
cd ProyectoWebAvanzada

# Dependencias reproducibles
npm ci --prefix frontend
npm ci --prefix backend

cd python-service
python -m venv .venv
source .venv/bin/activate          # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cd ..
```

Para la ejecución con Docker Compose no es necesario instalar nada más.

## 10. Variables de entorno y secretos

Los valores dependientes del ambiente **no están en el código**. Los archivos `.env.example` contienen solo nombres y valores ficticios; los `.env` reales están excluidos por `.gitignore`.

```bash
cp .env.example .env               # y reemplazar los valores
```

| Variable | Dónde se usa | Tipo en GitHub | Descripción |
|---|---|---|---|
| `APP_ENV` | Backend, CD | Variable | Ambiente (`development`, `test`, `staging`, `production`). |
| `POSTGRES_USER` | Compose, CD | Variable | Usuario de PostgreSQL. |
| `POSTGRES_DB` | Compose, CD | Variable | Nombre de la base de datos. |
| `POSTGRES_PORT` | Compose | Variable | Puerto de PostgreSQL en el host (5433 local). |
| `SCRAPER_CONTACT` | Python, CD | Variable | Contacto incluido en el *User-Agent* del scraper. |
| `AZURE_LOCATION`, `AZURE_DNS_LABEL`, `SSH_PUBLIC_KEY`, `TFSTATE_*` | Terraform, CD | Variable | Configuración no sensible de la infraestructura. |
| `POSTGRES_PASSWORD` | Compose, CD | **Secret** | Contraseña de PostgreSQL. |
| `JWT_SECRET` | Backend | **Secret** | Clave para firmar los JWT. |
| `INTERNAL_API_KEY` | Backend y Python | **Secret** | Clave de autenticación entre NestJS y FastAPI. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Backend | **Secret** | Crean/promueven el administrador inicial (contraseña de al menos 8 caracteres). |
| `SSH_PRIVATE_KEY` | CD | **Secret** | Acceso SSH al servidor de staging. |
| `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID` | Terraform | **Secret** | Credenciales de Azure. |
| `DATABASE_URL` | Backend / Prisma | (derivada) | Cadena de conexión; en Compose se arma con las variables anteriores. |
| `PYTHON_SERVICE_URL` | Backend | (derivada) | `http://python:8000` en Compose; `http://python-service:8000` en staging. |
| `PYTHON_TIMEOUT_MS`, `PYTHON_MAX_RETRIES`, `PYTHON_RETRY_DELAY_MS` | Backend | Opcional | Tiempo máximo (30000), reintentos (2) y espera entre reintentos (500). |
| `SOURCE_URL`, `CACHE_DIR` | Python | Opcional | URL de la fuente y carpeta de caché. |

Configuración en GitHub: *Settings → Secrets and variables → Actions → Variables / Secrets*. En los workflows se usan con `${{ vars.NOMBRE }}` y `${{ secrets.NOMBRE }}`; los secretos no se imprimen en los registros. El frontend toma la URL de la API de `frontend/src/environments/`.

## 11. Ejecución

### Con Docker Compose (recomendado)

```bash
docker compose up --build
```

| Servicio | URL local |
|---|---|
| Frontend | http://localhost:8080 |
| Backend NestJS | http://localhost:3000 (salud: `/health`) |
| Servicio Python | http://localhost:8000 (salud: `/health`) |
| PostgreSQL | `localhost:5433` |

El backend aplica las migraciones al iniciar (`prisma migrate deploy`). Para detener: `docker compose down` (`-v` borra también los volúmenes).

Para tener un administrador local, defina `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env` antes de levantar.

### Sin Docker (desarrollo)

```bash
# Terminal 1 – Python
cd python-service && uvicorn main:app --reload --port 8000
# Terminal 2 – Backend (requiere PostgreSQL y las variables del backend)
cd backend && npx prisma generate && npx prisma migrate deploy && npm run start:dev
# Terminal 3 – Frontend
cd frontend && npm start
```

### Android (Capacitor)

El APK de depuración se compila con el workflow manual **Android APK LISTOCO** (*Actions → Run workflow*) y se descarga como artefacto. Localmente: `cd frontend && npm run build && npx cap sync android`, y abrir `frontend/android` en Android Studio. En Android la aplicación usa la URL de la API de staging (ver `environment.prod.ts`).

## 12. Instrucciones de uso

1. Abrir la aplicación (staging o `http://localhost:8080`) y **registrarse** o iniciar sesión.
2. **Planificación:** explorar la malla por semestre y revisar la fuente y fecha de actualización.
3. Marcar las asignaturas **aprobadas** para actualizar el avance.
4. **Horarios:** elegir ramos, ajustar jornada, día libre y hora de término, **generar** alternativas y **guardar** la elegida.
5. **Calendario:** crear eventos personales y revisar los académicos.
6. **Trámites:** registrar una solicitud (p. ej. sobrecupo) y adjuntar documentos; se guarda internamente.
7. **Administrador:** en *Admin*, ejecutar la ingesta de la malla y revisar las corridas y sus métricas.

## 13. Pruebas

El sistema tiene pruebas en cada componente y una prueba de flujo completo.

| Nivel | Qué cubre | Dónde |
|---|---|---|
| Frontend | servicios, interceptor, guards, componentes | `frontend/src/**/*.spec.ts` |
| Backend (unitarias) | auth, JWT, roles, cliente Python (timeouts, reintentos, contrato), salud, observabilidad, cursos | `backend/src/**/*.spec.ts` |
| Backend (integración con PostgreSQL) | ingesta transaccional, idempotencia, desactivación | `backend/src/ingestion/ingestion.integration.spec.ts` |
| **Flujo completo** | cliente → NestJS → Python (simulado con el mismo contrato) → PostgreSQL → cliente, autenticación/autorización, validación y todos los escenarios de fallo | `backend/src/flow/flujo-completo.integration.spec.ts` |
| Python | extractor, normalizador, descarga y `robots.txt`, endpoints, datos inválidos, PDF real | `python-service/tests/` |
| Humo en ambiente desplegado | salud de servicios, frontend, consulta de datos, seguridad básica, login y (opcional) ingesta real | `scripts/smoke-test.sh` |

```bash
# Frontend
cd frontend && npm run lint && npm test -- --watch=false

# Python
cd python-service && python -m ruff check . && python -m pytest -q

# Backend: unitarias
cd backend && npm run lint && npm test
```

**Pruebas que usan PostgreSQL** (integración y flujo completo). Requieren una base **desechable** cuyo nombre contenga `test` (las tablas se vacían):

```bash
docker run -d --name listoco-test-db -e POSTGRES_USER=listoco_test \
  -e POSTGRES_PASSWORD=test_pass -e POSTGRES_DB=listoco_test -p 5434:5432 postgres:17-alpine

export TEST_DATABASE_URL="postgresql://listoco_test:test_pass@localhost:5434/listoco_test?schema=public"
cd backend
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm test                              # sin TEST_DATABASE_URL estas pruebas se omiten
REQUIRE_DB_TESTS=true npm test        # igual que el CI: falla si no hay base de pruebas
```

PowerShell: `$env:TEST_DATABASE_URL="postgresql://listoco_test:test_pass@localhost:5434/listoco_test?schema=public"`.

**Escenarios de la prueba de flujo completo:** ingesta correcta con propagación de `X-Request-Id` y clave interna; idempotencia; `/health` en estado `ok`; avance del estudiante aislado por usuario; 401 sin token o con token falso; 403 para estudiantes en rutas de administrador; registro que nunca crea administradores; validación 400; Python con error transitorio (reintentos limitados), lento (timeout), con respuesta fuera de contrato, no JSON, clave rechazada, fuente caída, `robots.txt` bloqueado y servicio apagado (degradación controlada, `/health = degraded` y datos aún disponibles).

**Prueba de humo contra un ambiente desplegado:**

```bash
./scripts/smoke-test.sh https://listoco-staging-980.mexicocentral.cloudapp.azure.com
# Compose local:
./scripts/smoke-test.sh http://localhost:3000 --python http://localhost:8000 --frontend http://localhost:8080
# Con login de administrador y flujo completo real (descarga el PDF de la PUCV):
ADMIN_EMAIL=... ADMIN_PASSWORD=... SMOKE_RUN_INGEST=true ./scripts/smoke-test.sh <url>
```

El despliegue en staging ejecuta esta prueba automáticamente y falla si alguna verificación no pasa.

## 14. Docker

Cada componente tiene su propio `Dockerfile`: `frontend/Dockerfile` (construcción multi-etapa, servido con nginx), `backend/Dockerfile` y `python-service/Dockerfile`. PostgreSQL usa la imagen oficial `postgres:17-alpine` con volumen persistente.

```bash
docker compose build                     # construye las tres imágenes
docker compose up --build                # levanta el sistema completo
docker compose -f docker-compose.staging.yml config   # valida el stack de staging
```

Los servicios se comunican por los nombres de Compose (`postgres`, `python`, `backend`), sin direcciones IP en el código. `docker-compose.yml` es el ambiente local; `docker-compose.staging.yml` es el stack del servidor (imágenes de GHCR por *tag* de commit y Caddy como *reverse proxy* con HTTPS).

## 15. Pipeline DevSecOps y despliegue

Los workflows están en `.github/workflows/`.

| Workflow | Disparador | Qué hace |
|---|---|---|
| `ci.yml` | Pull request a `main` | Linting (backend, frontend, Ruff), pruebas unitarias e integración con PostgreSQL efímero, CodeQL, `npm audit` y `pip-audit`, Gitleaks, construcción de los tres componentes, validación de Terraform (`fmt -check`, `init`, `validate`, `plan`) y un *quality gate* final. |
| `cd.yml` | Push a `main`/`staging` | Construye las imágenes Docker (etiquetadas con el SHA del commit), las analiza con **Trivy** (CRITICAL bloquea), las publica en GHCR y despliega en staging por SSH; verifica la dirección pública y ejecuta la **prueba de humo**. |
| `infra-apply.yml` | Manual | Aplica Terraform en Azure de forma controlada. |
| `android.yml` | Manual | Compila el APK de depuración. |

**Quality gates.** Un error de lint, una prueba fallida, un error de construcción, un secreto expuesto, una vulnerabilidad crítica (dependencias o imagen), una validación de Terraform fallida, un `/health` que no responde o una prueba de humo fallida **impiden continuar o desplegar**.

**Versión identificable.** Las imágenes y el servidor de staging usan el SHA del commit (`.deployed_tag` en el servidor y *label* `org.opencontainers.image.revision`), de modo que la versión desplegada corresponde a un commit del repositorio.

**Despliegue y rollback (`scripts/deploy.sh`).** Descarga las imágenes → levanta la base de datos → aplica las migraciones **antes** de cambiar contenedores (si fallan, la versión actual queda intacta) → levanta los servicios y espera el *health check* del backend. Si la nueva versión no queda sana, **vuelve automáticamente a la versión anterior**.

## 16. Infraestructura como código

`infra/` define con Terraform (proveedor `azurerm`) la red, el firewall, la IP pública, la máquina virtual de staging (con `cloud-init` que instala Docker) y sus salidas (`fqdn`, `public_ip_address`, `ssh_command`). El **estado remoto** vive en un Storage Account de Azure y nunca en el repositorio. Los pasos de preparación y las variables necesarias están en [`infra/README.md`](infra/README.md).

```bash
cd infra
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

## 17. Documentación de la API

Todas las rutas se publican bajo `/api` en staging (Caddy reescribe `/api/*` hacia el backend); en local no llevan prefijo. Las respuestas de error no incluyen trazas, consultas SQL ni credenciales. Cada respuesta incluye el encabezado `X-Request-Id`.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /auth/register` | Público | Crea un estudiante y devuelve el token. |
| `POST /auth/login` | Público | Inicia sesión; devuelve `accessToken` (JWT, 1 h). |
| `GET /health` | Público | Estado de NestJS, PostgreSQL, Python y la última ingesta (`ok` / `degraded` / `down`). |
| `GET /health/live` | Público | Indica que el proceso está vivo. |
| `GET /python/health` | Público | Estado del servicio Python. |
| `GET /courses` | Público | Lista asignaturas. Filtros: `semester` (1–12), `category`, `q`, `includeInactive`. |
| `GET /courses/:id` | Público | Detalle de una asignatura. |
| `POST /courses` | ADMIN | Crea una asignatura. |
| `POST /ingestion/curriculum` | ADMIN | Ejecuta la ingesta (NestJS → Python → PostgreSQL). |
| `GET /ingestion/runs` | ADMIN | Corridas de ingesta con procedencia y métricas. |
| `GET /academic-progress` | Autenticado | Avance académico propio. |
| `PUT /academic-progress/:courseId` | Autenticado | Marca el resultado (`APPROVED` / `FAILED`) de una asignatura. |
| `DELETE /academic-progress/:courseId` | Autenticado | Borra el registro de una asignatura. |
| `GET` · `PUT /schedule-preferences` | Autenticado | Lee o guarda las preferencias de horario. |
| `POST /schedule-generator/generate` | Autenticado | Genera alternativas de horario (`{ courseIds }`). |
| `POST /schedule-generator/save` | Autenticado | Guarda el horario elegido. |
| `GET /schedule-generator/saved` | Autenticado | Recupera el horario guardado. |
| `GET` · `POST /calendar-events` | Autenticado | Lista o crea eventos. |
| `PATCH` · `DELETE /calendar-events/:id` | Autenticado | Modifica o elimina un evento propio. |
| `GET` · `POST /academic-requests` | Autenticado | Lista o crea trámites propios. |
| `GET /academic-requests/:id` · `/attachment` | Autenticado | Detalle y adjunto de un trámite propio. |

**API interna del servicio Python** (no pública; exige `X-Internal-Api-Key`): `GET /health` y `POST /ingest/curriculum`. Su contrato de respuesta (`status`, `provenance`, `metrics`, `courses`, `warnings`) se valida en NestJS (`backend/src/python/dto/curriculum-response.dto.ts`). FastAPI expone además su documentación interactiva en `/docs` dentro de la red interna.

**Códigos de error del flujo NestJS ↔ Python:** `PYTHON_UNAVAILABLE` (503), `PYTHON_TIMEOUT` (503), `SOURCE_UNAVAILABLE` (503), `ROBOTS_DISALLOWED` (502), `SOURCE_INVALID` / `EXTRACTION_FAILED` (502), `PYTHON_INVALID_RESPONSE` (502), `PYTHON_AUTH_FAILED` (502), `PERSISTENCE_FAILED` (500).

## 18. Seguridad, privacidad y observabilidad

**Seguridad**

- Autenticación con JWT (expira en 1 h) y contraseñas con **bcrypt**. Autorización por roles con `JwtAuthGuard` + `RolesGuard`: un token válido no da acceso a todo.
- El registro público **siempre** crea estudiantes; el primer administrador sale de los secretos `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Validación y sanitización con DTO y `ValidationPipe` (`whitelist`); consultas parametrizadas con Prisma; CORS con lista de orígenes permitidos.
- Autenticación entre servicios con clave interna; el servicio Python no se expone (Caddy solo publica su `/health`).
- Secretos solo en GitHub Secrets; detección con Gitleaks; análisis estático con CodeQL; auditoría de dependencias; análisis de imágenes con Trivy.
- Datos personales mínimos (correo, contraseña con hash, avance y solicitudes del propio estudiante). Cada estudiante solo accede a sus datos. En staging se usan datos de prueba.

**Observabilidad**

- Registros **estructurados en JSON** con `request_id` de correlación que viaja cliente → NestJS → Python y se guarda en cada corrida de ingesta.
- Una línea `http_request` por solicitud con método, ruta (sin *query string*), código y `duration_ms`; FastAPI añade el encabezado `X-Process-Time-Ms`.
- `GET /health` (disponibilidad de NestJS, PostgreSQL, Python y estado de la fuente con latencias) y `GET /health/live`.
- Los registros no incluyen contraseñas, tokens ni claves.

## 19. Documentación adicional y diagramas

- [Diagrama de contexto](docs/architecture/diagramadecontexto.md)
- [Diagrama de componentes](docs/architecture/diagramadecomponentes.md)
- [Diagrama de despliegue](docs/architecture/diagramadedespliegue.md)
- [Diagrama de flujo](docs/architecture/diagramaflujo.md)
- [Modelo de base de datos](docs/architecture/modeloinicialbd.md)
- [Registro de decisiones arquitectónicas (ADR)](docs/architecture/registrodecisionesarquitectonicas.md)
- [Capacidad adaptativa (especificación y plan de evaluación)](docs/capacidad-adaptativa.md)
- [Infraestructura](infra/README.md) · [Backend](backend/README.md)

## 20. Limitaciones conocidas

- Los **prerrequisitos** no vienen de la Web: los aportaron estudiantes de la carrera y no están validados institucionalmente. Los **créditos** no están disponibles en la fuente.
- La **oferta de secciones y horarios** es de demostración (período 2027-1); no hay una fuente oficial de oferta ni de cupos.
- El puntaje del generador usa pesos fijos no calibrados con usuarios; aún no se realizó una evaluación con estudiantes.
- La inscripción y los trámites son **simulados**: no se comunican con sistemas de la universidad.
- La ingesta depende de que el PDF mantenga un formato similar; ante cambios de formato la extracción puede fallar (se detecta mediante las métricas y el error `EXTRACTION_FAILED`).
- Solo se cubre Ingeniería Civil Informática PUCV.
- Aún no hay *rate limiting* por usuario ni endpoint de métricas en formato Prometheus.
- La aplicación se entrega en navegador y Android (Capacitor); la capacidad de uso sin conexión (PWA con *service worker*) no está implementada. La versión iOS es opcional y no se construyó.
- El ambiente es de **staging**, con una sola máquina virtual: no hay alta disponibilidad.

## 21. Trabajo futuro

- Incorporar la oferta real de secciones y validar los prerrequisitos con la universidad.
- Calibrar los pesos del generador con estudiantes y comparar tiempos frente a armar el horario a mano.
- Mostrar el desglose del puntaje de cada alternativa (por qué sube o baja) y permitir ajustar los pesos.
- PWA con funcionamiento parcial sin conexión y notificaciones push.
- Métricas con Prometheus/Grafana, alertas y *rate limiting*.
- Documentar la API con OpenAPI/Swagger.
- Extender a otras carreras y a una versión iOS.

## 22. Licencia

Proyecto académico de uso educativo — Ingeniería Web Avanzada, PUCV
