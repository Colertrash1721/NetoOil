import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Company } from './entities/auth.entity';
import { Admin } from './entities/admin.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, Admin]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
        signOptions: { 
          expiresIn: '7d' 
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot(), // Asegúrate de tener esto
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}