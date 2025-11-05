import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateAuthDto {
  @IsNotEmpty()
  @IsString()
  company: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{9,11}$/, { message: 'RNC must be a valid number with 9 to 11 digits' })
  rnc: string;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 50)
  password: string;
}