import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Auth moduli. JwtModule sirsiz registratsiya qilinadi — har bir token
 * (access/refresh) signAsync/verifyAsync chaqiruvida o'z maxfiy kalitini beradi
 * (TokenService ichida), shuning uchun bu yerda global secret shart emas.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
