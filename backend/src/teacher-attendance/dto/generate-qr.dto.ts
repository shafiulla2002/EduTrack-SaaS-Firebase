import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class GenerateQrDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  requiresLocation?: boolean;
}
