import { IsString, IsNotEmpty, IsEmail, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateSupportRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Full Name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'School Name is required' })
  schoolName: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email address is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[0-9]{10,15}$/, { message: 'Phone number must be between 10 and 15 digits' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MinLength(20, { message: 'Message must be at least 20 characters' })
  @MaxLength(2000, { message: 'Message cannot exceed 2000 characters' })
  message: string;
}
