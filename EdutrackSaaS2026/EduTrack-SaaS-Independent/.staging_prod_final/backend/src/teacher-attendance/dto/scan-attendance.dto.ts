import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class ScanAttendanceDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  scanSource?: string; // IN_APP_SCANNER, MOBILE_CAMERA_DEEP_LINK, etc.
}
