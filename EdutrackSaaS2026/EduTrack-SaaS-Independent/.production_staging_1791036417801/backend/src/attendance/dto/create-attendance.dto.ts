// backend/src/attendance/dto/create-attendance.dto.ts

import { IsString, IsDateString, IsArray, IsOptional, IsInt, Min } from 'class-validator';

export class CreateAttendanceDto {
  @IsString()
  classSectionId: string;

  @IsDateString()
  date: string; // ISO date string (YYYY-MM-DD)

  @IsString()
  teacherId: string; // StaffProfile ID of the teacher taking attendance

  @IsInt()
  @Min(0)
  presentCount: number;

  @IsInt()
  @Min(0)
  absentCount: number;

  @IsInt()
  @Min(0)
  totalStudents: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  absentStudentIds?: string[];

  @IsString()
  @IsOptional()
  reason?: string;
}
