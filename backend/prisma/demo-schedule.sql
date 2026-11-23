
-- LISTOCO: oferta horaria ficticia para desarrollo.
-- NO corresponde a horarios oficiales de la PUCV.
-- Periodo de demostración: primer semestre de 2027.

BEGIN;

CREATE TEMP TABLE demo_horarios (
  codigo_ramo TEXT,
  codigo_seccion TEXT,
  dia "Weekday",
  inicio TEXT,
  termino TEXT,
  actividad TEXT
) ON COMMIT DROP;

INSERT INTO demo_horarios VALUES
-- Fundamentos de Algoritmos: dos alternativas
('fundamentos-de-algoritmos', 'DEMO-A', 'MONDAY', '09:00', '10:30', 'CATEDRA'),
('fundamentos-de-algoritmos', 'DEMO-A', 'WEDNESDAY', '09:00', '10:30', 'CATEDRA'),
('fundamentos-de-algoritmos', 'DEMO-B', 'TUESDAY', '14:00', '15:30', 'CATEDRA'),
('fundamentos-de-algoritmos', 'DEMO-B', 'THURSDAY', '14:00', '15:30', 'CATEDRA'),

-- Administración de Empresas: incluye choques posibles
('administracion-de-empresas', 'DEMO-A', 'MONDAY', '09:30', '11:00', 'CATEDRA'),
('administracion-de-empresas', 'DEMO-A', 'THURSDAY', '10:00', '11:30', 'CATEDRA'),
('administracion-de-empresas', 'DEMO-B', 'TUESDAY', '09:00', '10:30', 'CATEDRA'),
('administracion-de-empresas', 'DEMO-B', 'THURSDAY', '09:00', '10:30', 'CATEDRA'),

-- Análisis y Diseño de Algoritmos
('analisis-y-diseno-de-algoritmos', 'DEMO-A', 'TUESDAY', '10:00', '11:30', 'CATEDRA'),
('analisis-y-diseno-de-algoritmos', 'DEMO-A', 'FRIDAY', '10:00', '11:30', 'CATEDRA'),
('analisis-y-diseno-de-algoritmos', 'DEMO-B', 'MONDAY', '13:00', '14:30', 'CATEDRA'),
('analisis-y-diseno-de-algoritmos', 'DEMO-B', 'WEDNESDAY', '13:00', '14:30', 'CATEDRA'),

-- Bienestar y Aprendizaje Universitario
('bienestar-y-aprendizaje-universitario', 'DEMO-A', 'WEDNESDAY', '11:00', '12:30', 'TALLER'),
('bienestar-y-aprendizaje-universitario', 'DEMO-B', 'FRIDAY', '10:30', '12:00', 'TALLER');

-- Crear las secciones solo cuando la asignatura existe.
INSERT INTO "CourseSection"
  ("courseId", "code", "year", "semester", "isDemo", "active")
SELECT DISTINCT
  c."id",
  d.codigo_seccion,
  2027,
  1,
  TRUE,
  TRUE
FROM demo_horarios d
JOIN "Course" c
  ON c."code" = d.codigo_ramo
WHERE c."active" = TRUE
ON CONFLICT ("courseId", "code", "year", "semester")
DO NOTHING;

-- Crear bloques horarios sin duplicarlos.
INSERT INTO "ClassMeeting"
  ("sectionId", "day", "startTime", "endTime", "type")
SELECT
  s."id",
  d.dia,
  d.inicio,
  d.termino,
  d.actividad
FROM demo_horarios d
JOIN "Course" c
  ON c."code" = d.codigo_ramo
JOIN "CourseSection" s
  ON s."courseId" = c."id"
  AND s."code" = d.codigo_seccion
  AND s."year" = 2027
  AND s."semester" = 1
  AND s."isDemo" = TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM "ClassMeeting" m
  WHERE m."sectionId" = s."id"
    AND m."day" = d.dia
    AND m."startTime" = d.inicio
    AND m."endTime" = d.termino
    AND m."type" IS NOT DISTINCT FROM d.actividad
);

COMMIT;
