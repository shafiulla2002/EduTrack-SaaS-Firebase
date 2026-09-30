import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  workStartTime?: string; // e.g. "09:00 AM"

  @IsOptional()
  @IsNumber()
  lateThresholdMinutes?: number; // e.g. 15

  @IsOptional()
  @IsString()
  halfDayThresholdTime?: string; // e.g. "12:00 PM"

  @IsOptional()
  @IsString()
  attendanceCutoffTime?: string; // e.g. "02:00 PM"

  @IsOptional()
  @IsNumber()
  schoolLatitude?: number;

  @IsOptional()
  @IsNumber()
  schoolLongitude?: number;

  @IsOptional()
  @IsNumber()
  allowedRadiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  enableGeofencing?: boolean;
}
