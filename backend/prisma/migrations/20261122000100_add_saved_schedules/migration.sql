
-- ==========================================
-- LISTOCO: HORARIOS GUARDADOS
-- ==========================================

CREATE TABLE "SavedSchedule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSchedule_pkey" PRIMARY KEY ("id")
);

-- Un horario por estudiante, período y tipo de oferta
CREATE UNIQUE INDEX "SavedSchedule_userId_year_semester_isDemo_key"
ON "SavedSchedule"("userId", "year", "semester", "isDemo");

-- Facilitar búsquedas por período académico
CREATE INDEX "SavedSchedule_year_semester_idx"
ON "SavedSchedule"("year", "semester");

-- Relación con el estudiante
ALTER TABLE "SavedSchedule"
ADD CONSTRAINT "SavedSchedule_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;


-- ==========================================
-- SECCIONES DEL HORARIO GUARDADO
-- ==========================================

CREATE TABLE "SavedScheduleSection" (
    "savedScheduleId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,

    CONSTRAINT "SavedScheduleSection_pkey"
    PRIMARY KEY ("savedScheduleId", "sectionId")
);

-- Facilitar búsquedas por sección
CREATE INDEX "SavedScheduleSection_sectionId_idx"
ON "SavedScheduleSection"("sectionId");

-- Relación con el horario guardado
ALTER TABLE "SavedScheduleSection"
ADD CONSTRAINT "SavedScheduleSection_savedScheduleId_fkey"
FOREIGN KEY ("savedScheduleId")
REFERENCES "SavedSchedule"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Relación con la sección académica
ALTER TABLE "SavedScheduleSection"
ADD CONSTRAINT "SavedScheduleSection_sectionId_fkey"
FOREIGN KEY ("sectionId")
REFERENCES "CourseSection"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;