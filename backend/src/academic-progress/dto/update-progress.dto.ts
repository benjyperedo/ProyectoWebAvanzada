
import { IsEnum } from 'class-validator';
import { CourseResult } from '../../generated/prisma/enums.js';

export class UpdateProgressDto {
  @IsEnum(CourseResult)
  result!: CourseResult;
}
