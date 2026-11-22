CREATE TYPE "CourseResult" AS ENUM ('APPROVED', 'FAILED');

CREATE TABLE "StudentCourseProgress" (
    "userId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "result" "CourseResult" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCourseProgress_pkey"
        PRIMARY KEY ("userId", "courseId")
);

CREATE INDEX "StudentCourseProgress_courseId_idx"
    ON "StudentCourseProgress"("courseId");

ALTER TABLE "StudentCourseProgress"
    ADD CONSTRAINT "StudentCourseProgress_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentCourseProgress"
    ADD CONSTRAINT "StudentCourseProgress_courseId_fkey"
    FOREIGN KEY ("courseId")
    REFERENCES "Course"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;