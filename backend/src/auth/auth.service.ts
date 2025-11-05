import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateAuthDto } from './dto/createUser';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from './entities/auth.entity';
import { Admin } from './entities/admin.entity'
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { CreateAdminDto } from './dto/createAdmin';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Company) private companyRepository: Repository<Company>,
    @InjectRepository(Admin) private adminRepository: Repository<Admin>,
    private jwtService: JwtService,
  ) { }

  async create(createAuthDto: CreateAuthDto) {
    const email = await this.findCompanyByEmail(createAuthDto.email);
    const user = await this.companyRepository.findOne({ where: { username: createAuthDto.username } });
    
    if (email) {
      throw new HttpException(
        'Este email ya es usado, si olvido su contraseña contactese con el administrador',
        HttpStatus.FOUND,
      );
    }
    
    if (user) {
      throw new HttpException(
        'Este nombre de usuario ya existe, por favor elija otro',
        HttpStatus.FOUND,
      );
    }

    const hash = await bcrypt.hash(createAuthDto.password, 10);
    createAuthDto.password = hash;
    const response = await this.companyRepository.save(createAuthDto);
    return response;
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const email = await this.adminRepository.findOne({ where: { email: createAdminDto.email } });
    const user = await this.adminRepository.findOne({ where: { username: createAdminDto.username } });
    
    if (email) {
      throw new HttpException(
        'Este email ya es usado, si olvido su contraseña contactese con el administrador',
        HttpStatus.FOUND,
      );
    }
    
    if (user) {
      throw new HttpException(
        'Este nombre de usuario ya existe, por favor elija otro',
        HttpStatus.FOUND,
      );
    }

    const hash = await bcrypt.hash(createAdminDto.password, 10);
    createAdminDto.password = hash;
    const response = await this.adminRepository.save(createAdminDto);
    return response;
  }

  async login(user: string, pass: string, res: Response) {
    if (!user || !pass) {
      throw new HttpException(
        'No debe dejar campos vacios',
        HttpStatus.BAD_REQUEST, // Cambié a BAD_REQUEST (400)
      );
    }

    try {
      // Buscar company
      const company = await this.companyRepository.findOne({ 
        where: [{ email: user }, { username: user }] 
      });

      if (company) {
        return await this.handleCompanyLogin(company, pass, res);
      }

      // Buscar admin
      const admin = await this.adminRepository.findOne({ 
        where: [{ email: user }, { username: user }] 
      });

      if (admin) {
        return await this.handleAdminLogin(admin, pass, res);
      }

      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);

    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Error en el servidor', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async handleCompanyLogin(company: Company, password: string, res: Response) {
    if (company.state === "pending") {
      return { message: "Su cuenta aun no ha sido aprobada por un administrador" };
    }

    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      throw new HttpException('Contraseña incorrecta', HttpStatus.UNAUTHORIZED);
    }

    // Actualizar estado de conexión
    await this.companyRepository.update(company.idCompany, {
      isOnline: true,
      lastConection: new Date()
    });

    // Generar JWT
    const payload = { 
      sub: company.idCompany, 
      email: company.email, 
      company: company.company,
      role: 'company'
    };
    
    const jwt = await this.jwtService.signAsync(payload); // Usar signAsync

    // Establecer cookie
    res.cookie('jwt', jwt, { 
      // httpOnly: true, 
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      secure: process.env.NODE_ENV === 'production',
      // sameSite: 'strict'
    });

    return { 
      message: "Login exitoso", 
      user: { 
        username: company.username, 
        email: company.email, 
        role: 'company' 
      }, 
      token: jwt 
    };
  }

  private async handleAdminLogin(admin: Admin, password: string, res: Response) {
    const isMatchAdmin = await bcrypt.compare(password, admin.password);
    if (!isMatchAdmin) {
      throw new HttpException('Contraseña incorrecta', HttpStatus.UNAUTHORIZED);
    }

    const payload = { 
      sub: admin.idUser, // Cambié a 'id' o el campo correcto
      email: admin.email, 
      username: admin.username, 
      role: 'admin' 
    };

    const jwtAdmin = await this.jwtService.signAsync(payload); // Usar signAsync

    // Establecer cookie
    res.cookie('jwt', jwtAdmin, { 
      // httpOnly: true, 
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      secure: process.env.NODE_ENV === 'production',
      // sameSite: 'nonstrict'
    });

    // Actualizar estado de admin
    admin.isOnline = true;
    admin.lastConection = new Date();
    await this.adminRepository.save(admin);

    return { 
      message: "Login exitoso", 
      user: { 
        username: admin.username, 
        email: admin.email, 
        role: 'admin' 
      }, 
      token: jwtAdmin 
    };
  }

  async findCompanyByEmail(email: string) {
    return await this.companyRepository.findOne({ where: { email } });
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}