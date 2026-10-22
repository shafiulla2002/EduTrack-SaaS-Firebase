// backend/src/attendance/dto/update-attendance.dto.ts

import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateAttendanceDto {
  @IsString()
  @IsOptional()
  status?: string; // AttendanceStatus enum value as string

  @IsString()
  @IsOptional()
  reason?: string;
}
