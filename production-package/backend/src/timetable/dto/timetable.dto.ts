import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEmail, IsArray, ValidateNested, IsObject, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;
}

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class BulkSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class BulkSubjectsInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSubjectDto)
  subjects: BulkSubjectDto[];
}

export class CreateTeacherSkillDto {
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  skillLevel: string;

  @IsNumber()
  @IsOptional()
  yearsOfExperience?: number;
}

export class CreateTeacherWithSkillsDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  qualification?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsNumber()
  @IsOptional()
  basicSalary?: number;

  @IsNumber()
  @IsOptional()
  allowances?: number;

  @IsNumber()
  @IsOptional()
  deductions?: number;

  @IsNumber()
  @IsOptional()
  pfDeduction?: number;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  staffStatus?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTeacherSkillDto)
  skills: CreateTeacherSkillDto[];
}

export class BulkTeacherDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  qualification?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsNumber()
  @IsOptional()
  basicSalary?: number;

  @IsNumber()
  @IsOptional()
  allowances?: number;

  @IsNumber()
  @IsOptional()
  deductions?: number;

  @IsNumber()
  @IsOptional()
  pf?: number;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  subject1?: string;

  @IsString()
  @IsOptional()
  skillLevel1?: string;

  @IsString()
  @IsOptional()
  subject2?: string;

  @IsString()
  @IsOptional()
  skillLevel2?: string;

  @IsString()
  @IsOptional()
  subject3?: string;

  @IsString()
  @IsOptional()
  skillLevel3?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTeacherSkillDto)
  skills?: CreateTeacherSkillDto[];
}

export class BulkTeachersInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTeacherDto)
  teachers: BulkTeacherDto[];
}

export class CreateClassSectionDto {
  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @IsNumber()
  @IsOptional()
  classStrength?: number;

  @IsObject()
  subjectTeacherMap: Record<string, string[]>;

  @IsObject()
  @IsOptional()
  subjectPeriodsMap?: Record<string, number[]>;
}

export class UpdateTeacherAssignmentDto {
  @IsString()
  @IsOptional()
  newTeacherId?: string;

  @IsNumber()
  @IsOptional()
  periodsPerWeek?: number;
}

export class SaveSubstituteDto {
  @IsString()
  @IsNotEmpty()
  periodId: string;

  @IsString()
  @IsOptional()
  substituteTeacherId?: string;
}

export class SaveTimetablePeriodCellDto {
  @IsString()
  @IsNotEmpty()
  day: string;

  @IsNumber()
  @IsNotEmpty()
  periodNumber: number;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;
}

export class SaveTimetablePeriodsDto {
  @IsString()
  @IsNotEmpty()
  classSectionId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTimetablePeriodCellDto)
  periods: SaveTimetablePeriodCellDto[];
}

export class PeriodTimingDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsNumber()
  @IsNotEmpty()
  periodNumber: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isBreak?: boolean;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;
}

export class SaveTimetableConfigDto {
  @IsArray()
  @IsString({ each: true })
  workingDays: string[];

  @IsString()
  @IsNotEmpty()
  schoolStartTime: string;

  @IsString()
  @IsNotEmpty()
  schoolEndTime: string;

  @IsNumber()
  @IsNotEmpty()
  periodDuration: number;

  @IsBoolean()
  @IsNotEmpty()
  autoGenerate: boolean;

  @IsNumber()
  @IsNotEmpty()
  numPeriods: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeriodTimingDto)
  periods: PeriodTimingDto[];
}
