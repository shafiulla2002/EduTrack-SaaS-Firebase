import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamScheduleDto {
  @IsString()
  @IsNotEmpty()
  examName: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  classSectionId: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  examDate: string; // ISO String (e.g. "2026-08-15")

  @IsString()
  @IsNotEmpty()
  startTime: string; // "HH:MM" (e.g. "10:00")

  @IsString()
  @IsNotEmpty()
  endTime: string; // "HH:MM" (e.g. "13:00")

  @IsString()
  @IsOptional()
  examHall?: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsString()
  @IsOptional()
  status?: string; // "Draft" | "Published" | "Completed" | "Cancelled"
}

export class UpdateExamScheduleDto {
  @IsString()
  @IsOptional()
  examName?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsString()
  @IsOptional()
  classSectionId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  examDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  examHall?: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class BulkCreateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExamScheduleDto)
  schedules: CreateExamScheduleDto[];
}

export class BulkStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @IsNotEmpty()
  status: string;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
