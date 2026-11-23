
-- Crear los tipos para las preferencias del estudiante

CREATE TYPE "PreferredShift" AS ENUM (
    'MORNING',
    'AFTERNOON',
    'ANY'
);

CREATE TYPE "Weekday" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY'
);

-- Crear la tabla de preferencias de horario

CREATE TABLE "SchedulePreference" (
    "userId" INTEGER NOT NULL,
    "preferredShift" "PreferredShift" NOT NULL DEFAULT 'ANY',
    "preferredFreeDay" "Weekday",
    "latestEndTime" TEXT NOT NULL DEFAULT '18:00',
    "maxCourses" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePreference_pkey"
        PRIMARY KEY ("userId")
);

-- Relacionar las preferencias con el usuario

ALTER TABLE "SchedulePreference"
ADD CONSTRAINT "SchedulePreference_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
