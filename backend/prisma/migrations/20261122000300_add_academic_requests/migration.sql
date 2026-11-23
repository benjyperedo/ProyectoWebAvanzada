
-- ==========================================
-- LISTOCO
-- MIGRACIÓN: TRÁMITES ACADÉMICOS
-- ==========================================

-- ==========================================
-- 1. TIPOS DE TRÁMITES
-- ==========================================

CREATE TYPE "AcademicRequestType" AS ENUM (
    'ABSENCE_JUSTIFICATION',
    'OVERCAPACITY',
    'ENROLLMENT_PROBLEM',
    'OTHER'
);

-- ==========================================
-- 2. ESTADOS DE LOS TRÁMITES
-- ==========================================

CREATE TYPE "AcademicRequestStatus" AS ENUM (
    'REGISTERED'
);

-- ==========================================
-- 3. TABLA DE SOLICITUDES ACADÉMICAS
-- ==========================================

CREATE TABLE "AcademicRequest" (

    "id" SERIAL NOT NULL,

    "userId" INTEGER NOT NULL,

    "type" "AcademicRequestType" NOT NULL,

    "status" "AcademicRequestStatus"
        NOT NULL DEFAULT 'REGISTERED',

    "recipientEmail" VARCHAR(255) NOT NULL,

    "courseName" VARCHAR(150),

    "absenceDate" DATE,

    "subject" VARCHAR(150),

    "description" TEXT NOT NULL,

    "createdAt" TIMESTAMP(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicRequest_pkey"
        PRIMARY KEY ("id")
);

-- ==========================================
-- 4. TABLA DE ARCHIVOS ADJUNTOS
-- ==========================================

CREATE TABLE "AcademicRequestAttachment" (

    "requestId" INTEGER NOT NULL,

    "fileName" VARCHAR(255) NOT NULL,

    "mimeType" VARCHAR(100) NOT NULL,

    "sizeBytes" INTEGER NOT NULL,

    "content" BYTEA NOT NULL,

    CONSTRAINT "AcademicRequestAttachment_pkey"
        PRIMARY KEY ("requestId")
);

-- ==========================================
-- 5. ÍNDICE PARA CONSULTAR MIS TRÁMITES
-- ==========================================

CREATE INDEX "AcademicRequest_userId_createdAt_idx"
ON "AcademicRequest" (
    "userId",
    "createdAt"
);

-- ==========================================
-- 6. RELACIÓN ENTRE USUARIO Y SOLICITUD
-- ==========================================

ALTER TABLE "AcademicRequest"
ADD CONSTRAINT "AcademicRequest_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ==========================================
-- 7. RELACIÓN ENTRE SOLICITUD Y ADJUNTO
-- ==========================================

ALTER TABLE "AcademicRequestAttachment"
ADD CONSTRAINT "AcademicRequestAttachment_requestId_fkey"
FOREIGN KEY ("requestId")
REFERENCES "AcademicRequest"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
