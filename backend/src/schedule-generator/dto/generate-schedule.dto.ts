import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';

import { UpdateSchedulePreferencesDto } from '../../schedule-preferences/dto/update-schedule-preferences.dto.js';

export class GenerateScheduleDto {
  // Los ramos se siguen validando en el servicio, para conservar sus mensajes.
  @IsOptional()
  @IsArray()
  courseIds?: number[];

  // Preferencias de esta petición. Si no vienen, se usan las guardadas.
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSchedulePreferencesDto)
  preferences?: UpdateSchedulePreferencesDto;
}