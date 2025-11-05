import { Controller, Get, Post, Body, Patch, Param, Delete, Res, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/createUser';
import { CreateAdminDto } from './dto/createAdmin';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post()
  create(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.create(createAuthDto);
  }

  @Post('admin')
  createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.createAdmin(createAdminDto);
  }

  @Post('login')
  login(@Body() body: { user: string, password: string }, 
  @Res({ passthrough: true }) res: Response) {
    const { user, password } = body;
    return this.authService.login(user, password, res);
  }

  @Post('logout')
  logout(@Body() body: {username: string, token: any},
  @Res({passthrough: true}) res: Response) {
    const {username, token} = body;
    res.clearCookie('jwt');
    // return this.authService.logout(username, token);
  }

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
}
