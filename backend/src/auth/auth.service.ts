import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateAuthDto } from './dto/create_user';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from './entities/auth.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(@InjectRepository(Company) private companyRepository: Repository<Company>){}
  async create(createAuthDto: CreateAuthDto) {
    const user = await this.findCompanyByEmail(createAuthDto.email);
    if (user) {
      throw new HttpException(
        'Este email ya es usado, si olvido su contraseña contactese con el administrador',
        HttpStatus.FOUND,
      );
    }

    const hash = await bcrypt.hash(createAuthDto.password, 10);
    return this.companyRepository.create(createAuthDto);
  }

  async findCompanyByEmail(email: string){
    return await this.companyRepository.findOne({where: {email}})
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
