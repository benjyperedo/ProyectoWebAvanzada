
import {
  IsEnum,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  PreferredShift,
  Weekday,
} from '../../generated/prisma/enums.js';

export class UpdateSchedulePreferencesDto {

  // Jornada: mañana, tarde o indiferente
  @IsEnum(PreferredShift)
  preferredShift!: PreferredShift;

  // Día libre: lunes a viernes, o ninguno
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Weekday)
  preferredFreeDay!: Weekday | null;

  // Hora máxima de término permitida
  @IsIn(['16:00', '18:00', '20:00'])
  latestEndTime!: string;

  // Cantidad máxima de asignaturas: entre 1 y 8
  @IsInt()
  @Min(1)
  @Max(8)
  maxCourses!: number;
}
