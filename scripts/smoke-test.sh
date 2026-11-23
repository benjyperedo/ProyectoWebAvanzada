#!/usr/bin/env bash
# Pruebas de humo del flujo completo sobre un ambiente YA DESPLEGADO
# (staging) o levantado con Docker Compose.
#
# Uso:
#   ./scripts/smoke-test.sh https://<host>            # staging (Caddy: /api, /python)
#   ./scripts/smoke-test.sh http://localhost:3000 \
#       --python http://localhost:8000 --frontend http://localhost:8080   # Compose local
#
# Variables opcionales:
#   ADMIN_EMAIL, ADMIN_PASSWORD   Verifica el inicio de sesion de administrador.
#   SMOKE_RUN_INGEST=true         Ademas ejecuta la ingesta real (Angular→NestJS→
#                                 Python→PostgreSQL). Descarga el PDF de la PUCV:
#                                 no se usa como compuerta del despliegue.
#
# Requiere: bash, curl y jq. Termina con codigo distinto de 0 si algo falla.
set -uo pipefail

BASE="${1:?Uso: $0 <url-base> [--python URL] [--frontend URL]}"
shift
PY_URL=""
FRONT_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --python) PY_URL="$2"; shift 2 ;;
    --frontend) FRONT_URL="$2"; shift 2 ;;
    *) echo "Argumento desconocido: $1"; exit 2 ;;
  esac
done

BASE="${BASE%/}"
if [[ -z "$PY_URL" && -z "$FRONT_URL" ]]; then
  # Modo staging: todo detras del mismo host (ver Caddyfile).
  API="$BASE/api"; PY_HEALTH="$BASE/python/health"; PY_INTERNAL="$BASE/python/ingest/curriculum"; FRONT="$BASE/"
else
  API="$BASE"; PY_HEALTH="${PY_URL%/}/health"; PY_INTERNAL=""; FRONT="${FRONT_URL%/}/"
fi

FAILS=0
ok()   { echo "  OK   $1"; }
fail() { echo "  FALLA $1"; FAILS=$((FAILS + 1)); }
check() { # check "descripcion" comando...
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else fail "$desc"; fi
}
status_of() { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$@" 2>/dev/null || echo 000; }

echo "== Humo: $BASE"

echo "-- 1. Salud de los servicios"
HEALTH="$(curl -sS --max-time 15 "$API/health" 2>/dev/null || true)"
check "NestJS /health responde JSON"                 jq -e . <<<"$HEALTH"
check "PostgreSQL conectado (checks.database=up)"    jq -e '.checks.database.status=="up"' <<<"$HEALTH"
check "Python alcanzable desde NestJS (checks.python=up)" jq -e '.checks.python.status=="up"' <<<"$HEALTH"
echo "     estado general: $(jq -r '.status // "?"' <<<"$HEALTH" 2>/dev/null) | fuente: $(jq -r '.checks.source.status // "?"' <<<"$HEALTH" 2>/dev/null)"
check "Python /health responde 200"                  test "$(status_of "$PY_HEALTH")" = 200

echo "-- 2. Frontend"
FRONT_BODY="$(curl -sS --max-time 15 "$FRONT" 2>/dev/null || true)"
check "El frontend entrega la aplicacion Angular"    grep -q "<app-root" <<<"$FRONT_BODY"

echo "-- 3. Datos y consulta (NestJS ← PostgreSQL)"
COURSES="$(curl -sS --max-time 15 "$API/courses" 2>/dev/null || true)"
check "GET /courses devuelve una lista"              jq -e 'type=="array"' <<<"$COURSES"
echo "     asignaturas disponibles: $(jq 'length' <<<"$COURSES" 2>/dev/null || echo '?')"
check "Filtro invalido responde 400 (validacion)"    test "$(status_of "$API/courses?semester=99")" = 400

echo "-- 4. Seguridad"
check "Ingesta sin token responde 401"               test "$(status_of -X POST "$API/ingestion/curriculum")" = 401
check "Token falso responde 401"                     test "$(status_of -X POST -H 'Authorization: Bearer falso' "$API/ingestion/curriculum")" = 401
if [[ -n "$PY_INTERNAL" ]]; then
  check "El endpoint interno de Python NO esta expuesto" test "$(status_of -X POST "$PY_INTERNAL")" = 404
fi

if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  echo "-- 5. Administrador"
  LOGIN="$(curl -sS --max-time 15 -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e,password:$p}')" 2>/dev/null || true)"
  TOKEN="$(jq -r '.accessToken // empty' <<<"$LOGIN" 2>/dev/null)"
  if [[ -n "$TOKEN" ]]; then
    ok "Login de administrador"
    check "GET /ingestion/runs con rol ADMIN responde 200" \
      test "$(status_of -H "Authorization: Bearer $TOKEN" "$API/ingestion/runs")" = 200
    if [[ "${SMOKE_RUN_INGEST:-false}" == "true" ]]; then
      echo "-- 6. Flujo completo: ingesta real"
      RID="smoke-$(date +%s)"
      RES="$(curl -sS --max-time 120 -X POST -H "Authorization: Bearer $TOKEN" -H "X-Request-Id: $RID" \
        "$API/ingestion/curriculum" 2>/dev/null || true)"
      check "Ingesta Angular→NestJS→Python→PostgreSQL exitosa" jq -e '.status=="SUCCESS" or .status=="DEGRADED"' <<<"$RES"
      echo "     request_id=$RID  metricas: $(jq -c '.metrics // .' <<<"$RES" 2>/dev/null)"
    fi
  else
    fail "Login de administrador"
  fi
fi

echo
if [[ "$FAILS" -gt 0 ]]; then
  echo "== $FAILS verificacion(es) fallaron"
  exit 1
fi
echo "== Todas las verificaciones pasaron"