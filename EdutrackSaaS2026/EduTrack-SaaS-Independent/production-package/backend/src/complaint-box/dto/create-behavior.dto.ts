// src/complaint-box/dto/create-behavior.dto.ts
import { IsNotEmpty, IsString, IsEnum, MinLength } from 'class-validator';

export enum BehaviorTypeEnum {
  COMPLAINT = 'Complaint',
  PRAISE = 'Praise',
}

export class CreateBehaviorDto {
  @IsNotEmpty()
  @IsString()
  studentId: string;

  @IsNotEmpty()
  @IsEnum(BehaviorTypeEnum)
  behaviorType: BehaviorTypeEnum;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  description: string;

  @IsNotEmpty()
  @IsString()
  academicYear: string;

  @IsNotEmpty()
  @IsString()
  teacherId: string;
}
