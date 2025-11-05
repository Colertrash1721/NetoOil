import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateAdminDto {
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