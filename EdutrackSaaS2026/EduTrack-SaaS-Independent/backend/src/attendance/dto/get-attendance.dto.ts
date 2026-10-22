import { IsString, IsNotEmpty } from 'class-validator';

export class GetAttendanceDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
