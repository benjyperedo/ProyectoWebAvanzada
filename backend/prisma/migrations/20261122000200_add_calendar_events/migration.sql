
-- ==========================================
-- LISTOCO - EVENTOS DEL CALENDARIO
-- ==========================================

-- 1. Categorías disponibles para los eventos
CREATE TYPE "CalendarEventCategory" AS ENUM (
    'UNIVERSITY',
    'PERSONAL'
);

-- 2. Tabla de eventos de los estudiantes
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "eventDate" DATE NOT NULL,
    "startTime" TEXT,
    "category" "CalendarEventCategory" NOT NULL,
    "reminderMinutesBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- 3. Índice para consultar eventos por estudiante y fecha
CREATE INDEX "CalendarEvent_userId_eventDate_idx"
ON "CalendarEvent"("userId", "eventDate");

-- 4. Relación con el estudiante propietario
ALTER TABLE "CalendarEvent"
ADD CONSTRAINT "CalendarEvent_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
