
-- ==========================================
-- SECCIONES DE ASIGNATURAS
-- ==========================================

CREATE TABLE "CourseSection" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- Evitar duplicar una sección en un período
CREATE UNIQUE INDEX "CourseSection_courseId_code_year_semester_key"
ON "CourseSection"("courseId", "code", "year", "semester");

-- Facilitar búsquedas por período académico
CREATE INDEX "CourseSection_year_semester_idx"
ON "CourseSection"("year", "semester");

-- Relación con la asignatura
ALTER TABLE "CourseSection"
ADD CONSTRAINT "CourseSection_courseId_fkey"
FOREIGN KEY ("courseId")
REFERENCES "Course"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


-- ==========================================
-- BLOQUES HORARIOS
-- ==========================================

CREATE TABLE "ClassMeeting" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "day" "Weekday" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" TEXT,

    CONSTRAINT "ClassMeeting_pkey" PRIMARY KEY ("id")
);

-- Facilitar consultas de bloques por sección
CREATE INDEX "ClassMeeting_sectionId_idx"
ON "ClassMeeting"("sectionId");

-- Relación con la sección
ALTER TABLE "ClassMeeting"
ADD CONSTRAINT "ClassMeeting_sectionId_fkey"
FOREIGN KEY ("sectionId")
REFERENCES "CourseSection"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
