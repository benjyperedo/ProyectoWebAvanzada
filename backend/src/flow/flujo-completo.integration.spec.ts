/**
 * Prueba de flujo completo del backend (NestJS ↔ servicio Python ↔ PostgreSQL).
 *
 * Recorre el mismo camino que sigue la aplicación en producción:
 *
 *   cliente HTTP (lo que haría Angular)
 *     → NestJS real (AppModule: guards, pipes, JWT, Prisma)
 *       → servicio "Python" simulado que respeta el contrato de FastAPI
 *         (/health y POST /ingest/curriculum con X-Internal-Api-Key)
 *     → PostgreSQL real
 *     → respuesta al cliente
 *
 * El servicio Python se simula con un servidor HTTP local para poder provocar
 * de forma determinista fallos que en la realidad son difíciles de reproducir
 * (caída, lentitud, respuestas inválidas, clave rechazada). El procesamiento
 * real del PDF se prueba aparte, en python-service/tests.
 *
 * Igual que ingestion.integration.spec.ts, solo se ejecuta si TEST_DATABASE_URL
 * apunta a una base DESECHABLE (su nombre debe contener "test"): las tablas se
 * vacían. En el CI es obligatoria (REQUIRE_DB_TESTS=true).
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';

import { PrismaClient } from '../generated/prisma/client.js';
import { requestContextMiddleware } from '../observability/request-context.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const isDisposable = !!databaseUrl && /test/i.test(new URL(databaseUrl).pathname);
if (process.env.REQUIRE_DB_TESTS === 'true' && !isDisposable) {
  throw new Error(
    'REQUIRE_DB_TESTS=true, pero TEST_DATABASE_URL no apunta a una base de pruebas',
  );
}

const INTERNAL_KEY = 'clave-interna-solo-para-pruebas';
const ADMIN_EMAIL = 'admin-flujo@test.cl';
const ADMIN_PASSWORD = 'admin-flujo-123';
const TIMEOUT_MS = 400;

// ---------------------------------------------------------------------------
// Servicio Python simulado
// ---------------------------------------------------------------------------

type Mode =
  | 'ok'
  | 'unavailable' // 503 sin código: error transitorio, se reintenta
  | 'slow' // no responde antes del tiempo máximo
  | 'invalid-contract' // JSON válido que no cumple el contrato
  | 'not-json'
  | 'source-unavailable' // Python informa que la fuente web no responde
  | 'robots-disallowed' // Python informa que robots.txt no permite descargar
  | 'wrong-key'; // Python rechaza la clave interna

const COURSES_V1 = [
  { code: 'algebra-lineal', name: 'Álgebra Lineal', semester: 1, category: 'Ciencias Básicas' },
  { code: 'calculo-i', name: 'Cálculo I', semester: 1, category: 'Ciencias Básicas' },
  { code: 'programacion-i', name: 'Programación I', semester: 2, category: 'Informática' },
];

function validBody() {
  return {
    status: 'ok',
    provenance: {
      source_name: 'PUCV - Plan de Estudios',
      source_url: 'https://pucv.cl/plan.pdf',
      fetched_at: '2026-11-20T15:00:00Z',
      sha256: 'a'.repeat(64),
      content_length: 100706,
      resolution: 'DRA 61/2020',
      from_cache: false,
      changed: null,
      extractor_version: '2.0.0',
    },
    metrics: {
      candidates: COURSES_V1.length,
      valid: COURSES_V1.length,
      rejected: 0,
      duplicates: 0,
      semesters_detected: 2,
      semesters_expected: 2,
      coverage: 1,
      valid_ratio: 1,
      duration_ms: 120,
    },
    courses: COURSES_V1,
    warnings: [],
  };
}

class FakePython {
  mode: Mode = 'ok';
  ingestCalls = 0;
  lastHeaders: IncomingMessage['headers'] = {};
  private server: Server | undefined;
  port = 0;

  async start(port = 0): Promise<void> {
    this.server = createServer((req, res) => {
      const json = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (req.method === 'GET' && req.url === '/health') {
        return json(200, { status: 'ok', service: 'python-fastapi' });
      }

      if (req.method === 'POST' && req.url === '/ingest/curriculum') {
        this.ingestCalls += 1;
        this.lastHeaders = req.headers;
        req.resume();

        if (this.mode === 'wrong-key' || req.headers['x-internal-api-key'] !== INTERNAL_KEY) {
          return json(401, { error: { code: 'UNAUTHORIZED', message: 'clave inválida' } });
        }
        switch (this.mode) {
          case 'unavailable':
            return json(503, { detail: 'reiniciando' });
          case 'slow':
            // Se responde mucho después del tiempo máximo del cliente.
            return void setTimeout(() => json(200, validBody()), TIMEOUT_MS * 5);
          case 'invalid-contract':
            return json(200, { ...validBody(), courses: [] });
          case 'not-json':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return void res.end('<html>no es JSON</html>');
          case 'source-unavailable':
            return json(503, { error: { code: 'SOURCE_UNAVAILABLE', message: 'fuente caída' } });
          case 'robots-disallowed':
            return json(502, { error: { code: 'ROBOTS_DISALLOWED', message: 'robots.txt' } });
          default:
            return json(200, validBody());
        }
      }

      return json(404, { detail: 'no encontrado' });
    });

    const server = this.server;
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    this.port = (server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.server = undefined;
  }

  reset() {
    this.mode = 'ok';
    this.ingestCalls = 0;
    this.lastHeaders = {};
  }
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

describe.skipIf(!isDisposable)('Flujo completo: cliente → NestJS → Python → PostgreSQL', () => {
  const python = new FakePython();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl ?? '' }),
  });
  let app: INestApplication;
  let adminToken = '';
  let studentToken = '';
  let otherStudentToken = '';

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string, password: string): Promise<string> {
    const res = await request(server()).post('/auth/login').send({ email, password }).expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function register(email: string): Promise<string> {
    const res = await request(server())
      .post('/auth/register')
      .send({ email, password: 'clave-segura-1' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Course","IngestionRun","DataSource","User" RESTART IDENTITY CASCADE',
    );
    await python.start();

    // La configuración se lee del entorno al construir los módulos.
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'jwt-secret-solo-para-pruebas';
    process.env.PYTHON_SERVICE_URL = `http://127.0.0.1:${python.port}`;
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
    process.env.PYTHON_TIMEOUT_MS = String(TIMEOUT_MS);
    process.env.PYTHON_MAX_RETRIES = '2';
    process.env.PYTHON_RETRY_DELAY_MS = '10';
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

    const { AppModule } = await import('../app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración global que main.ts.
    app.use(requestContextMiddleware);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    studentToken = await register('estudiante1@test.cl');
    otherStudentToken = await register('estudiante2@test.cl');
  });

  beforeEach(async () => {
    python.reset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Course","IngestionRun","DataSource" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app?.close();
    await python.stop();
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  describe('camino normal', () => {
    it('la ingesta recorre cliente → NestJS → Python → PostgreSQL y los datos quedan consultables', async () => {
      const res = await request(server())
        .post('/ingestion/curriculum')
        .set(auth(adminToken))
        .set('X-Request-Id', 'flujo-normal-1')
        .expect(201);

      const body = res.body as {
        status: string;
        persistence: Record<string, number>;
        provenance: { sha256: string; sourceUrl: string };
        metrics: { validRatio: number; coverage: number };
      };
      expect(body.status).toBe('SUCCESS');
      expect(body.persistence).toEqual({ created: 3, updated: 0, unchanged: 0, deactivated: 0 });
      expect(body.provenance.sourceUrl).toBe('https://pucv.cl/plan.pdf');
      expect(body.metrics).toMatchObject({ validRatio: 1, coverage: 1 });

      // Correlación: el mismo identificador viaja cliente → NestJS → Python.
      expect(res.headers['x-request-id']).toBe('flujo-normal-1');
      expect(python.lastHeaders['x-request-id']).toBe('flujo-normal-1');
      // Autenticación entre servicios.
      expect(python.lastHeaders['x-internal-api-key']).toBe(INTERNAL_KEY);

      // Persistencia en PostgreSQL con procedencia.
      const stored = await prisma.course.findMany({ include: { source: true } });
      expect(stored).toHaveLength(3);
      expect(stored.every((c) => c.source?.key === 'pucv-plan-ici' && c.lastRunId !== null)).toBe(true);

      // Consulta desde el cliente (lo que muestra Angular).
      const list = await request(server()).get('/courses').expect(200);
      expect((list.body as unknown[]).length).toBe(3);

      const sem2 = await request(server()).get('/courses').query({ semester: 2 }).expect(200);
      expect((sem2.body as { code: string }[]).map((c) => c.code)).toEqual(['programacion-i']);

      // Trazabilidad: la corrida queda registrada con su request-id.
      const runs = await request(server()).get('/ingestion/runs').set(auth(adminToken)).expect(200);
      expect(runs.body).toHaveLength(1);
      expect((runs.body as { status: string; requestId: string }[])[0]).toMatchObject({
        status: 'SUCCESS',
        requestId: 'flujo-normal-1',
      });
    });

    it('repetir la ingesta es idempotente (no duplica registros)', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(201);
      const again = await request(server())
        .post('/ingestion/curriculum')
        .set(auth(adminToken))
        .expect(201);

      expect((again.body as { persistence: unknown }).persistence).toEqual({
        created: 0,
        updated: 0,
        unchanged: 3,
        deactivated: 0,
      });
      expect(await prisma.course.count()).toBe(3);
      expect(await prisma.ingestionRun.count()).toBe(2);
    });

    it('/health refleja NestJS, PostgreSQL, Python y la fuente tras una ingesta exitosa', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(201);

      const res = await request(server()).get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        service: 'nestjs-backend',
        checks: {
          database: { status: 'up' },
          python: { status: 'up' },
          source: { status: 'up', last_run_status: 'SUCCESS' },
        },
      });
    });

    it('el estudiante guarda su avance y solo él lo ve', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(201);
      // 'calculo-i' no tiene prerrequisitos, así que se puede aprobar directamente.
      const course = await prisma.course.findFirstOrThrow({ where: { code: 'calculo-i' } });

      await request(server())
        .put(`/academic-progress/${course.id}`)
        .set(auth(studentToken))
        .send({ result: 'APPROVED' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const mine = await request(server()).get('/academic-progress').set(auth(studentToken)).expect(200);
      expect(JSON.stringify(mine.body)).toContain('APPROVED');

      const theirs = await request(server())
        .get('/academic-progress')
        .set(auth(otherStudentToken))
        .expect(200);
      expect(JSON.stringify(theirs.body)).not.toContain('APPROVED');
    });
  });

  // -------------------------------------------------------------------------
  describe('autenticación y autorización', () => {
    it('sin token no se puede ingerir (401) y Python no es invocado', async () => {
      await request(server()).post('/ingestion/curriculum').expect(401);
      expect(python.ingestCalls).toBe(0);
    });

    it('un token inválido o manipulado se rechaza (401)', async () => {
      await request(server())
        .post('/ingestion/curriculum')
        .set(auth(`${adminToken}x`))
        .expect(401);
    });

    it('un estudiante con token válido no puede ingerir ni ver corridas (403)', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(studentToken)).expect(403);
      await request(server()).get('/ingestion/runs').set(auth(studentToken)).expect(403);
      expect(python.ingestCalls).toBe(0);
    });

    it('el registro público siempre crea estudiantes, nunca administradores', async () => {
      const res = await request(server())
        .post('/auth/register')
        .send({ email: 'intento-admin@test.cl', password: 'clave-segura-1', role: 'ADMIN' })
        .expect(201);
      expect((res.body as { user: { role: string } }).user.role).toBe('STUDENT');
    });

    it('credenciales incorrectas responden 401 con mensaje genérico', async () => {
      const res = await request(server())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'incorrecta' })
        .expect(401);
      expect(JSON.stringify(res.body)).not.toMatch(/hash|bcrypt|prisma/i);
    });
  });

  // -------------------------------------------------------------------------
  describe('validación de entradas', () => {
    it('filtros inválidos en /courses responden 400', async () => {
      await request(server()).get('/courses').query({ semester: 99 }).expect(400);
      await request(server()).get('/courses').query({ semester: 'abc' }).expect(400);
    });

    it('un correo inválido en el login responde 400', async () => {
      await request(server()).post('/auth/login').send({ email: 'no-es-correo', password: 'x' }).expect(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('fallos y degradación controlada del servicio Python', () => {
    type Case = { mode: Mode; status: number; code: string };
    const cases: Case[] = [
      { mode: 'unavailable', status: 503, code: 'PYTHON_UNAVAILABLE' },
      { mode: 'slow', status: 503, code: 'PYTHON_TIMEOUT' },
      { mode: 'invalid-contract', status: 502, code: 'PYTHON_INVALID_RESPONSE' },
      { mode: 'not-json', status: 502, code: 'PYTHON_INVALID_RESPONSE' },
      { mode: 'wrong-key', status: 502, code: 'PYTHON_AUTH_FAILED' },
      { mode: 'source-unavailable', status: 503, code: 'SOURCE_UNAVAILABLE' },
      { mode: 'robots-disallowed', status: 502, code: 'ROBOTS_DISALLOWED' },
    ];

    it.each(cases)(
      'Python en modo "$mode" → NestJS responde $status con código $code, sin filtrar detalles internos',
      async ({ mode, status, code }) => {
        python.mode = mode;

        const res = await request(server())
          .post('/ingestion/curriculum')
          .set(auth(adminToken))
          .expect(status);

        const body = res.body as { code: string; message: string };
        expect(body.code).toBe(code);
        expect(body.message.length).toBeGreaterThan(10);
        // Nada interno en la respuesta: ni clave, ni URLs internas, ni trazas.
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(INTERNAL_KEY);
        expect(text).not.toMatch(/127\.0\.0\.1|ECONN|stack|at .*\.ts/i);

        // La falla queda registrada para trazabilidad.
        const run = await prisma.ingestionRun.findFirstOrThrow({ orderBy: { id: 'desc' } });
        expect(run).toMatchObject({ status: 'FAILED', errorCode: code });
        expect(await prisma.course.count()).toBe(0);
      },
    );

    it('los fallos transitorios se reintentan de forma limitada (3 intentos) y los deterministas no', async () => {
      python.mode = 'unavailable';
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(503);
      expect(python.ingestCalls).toBe(3);

      python.reset();
      python.mode = 'invalid-contract';
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(502);
      expect(python.ingestCalls).toBe(1);
    });

    it('la lentitud de Python no bloquea a NestJS más allá del tiempo máximo', async () => {
      python.mode = 'slow';
      const started = Date.now();
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(503);
      // 3 intentos de ~400 ms; si no hubiera timeout tardaría > 6 s.
      expect(Date.now() - started).toBeLessThan(4000);
    });

    it('si falla la actualización, los datos ya guardados siguen disponibles para el estudiante', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(201);

      python.mode = 'source-unavailable';
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(503);

      const list = await request(server()).get('/courses').expect(200);
      expect((list.body as unknown[]).length).toBe(3);
    });

    it('/health pasa a "degraded" cuando la última ingesta falló, sin caerse', async () => {
      python.mode = 'source-unavailable';
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(503);

      const res = await request(server()).get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: 'degraded',
        checks: { database: { status: 'up' }, source: { status: 'down', last_run_status: 'FAILED' } },
      });
    });

    it('con el servicio Python apagado: la ingesta responde 503 comprensible, /health = degraded y el resto de la API sigue funcionando', async () => {
      await request(server()).post('/ingestion/curriculum').set(auth(adminToken)).expect(201);
      const port = python.port;
      await python.stop();

      try {
        const res = await request(server())
          .post('/ingestion/curriculum')
          .set(auth(adminToken))
          .expect(503);
        expect((res.body as { code: string }).code).toBe('PYTHON_UNAVAILABLE');

        const health = await request(server()).get('/health').expect(200);
        expect(health.body).toMatchObject({
          status: 'degraded',
          checks: { database: { status: 'up' }, python: { status: 'down' } },
        });

        // Degradación controlada: consultar la malla no depende de Python.
        await request(server()).get('/courses').expect(200);
        await request(server()).get('/health/live').expect(200);
      } finally {
        await python.start(port);
      }
    });
  });
});