import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Avval berilgan refresh token' })
  @IsJWT({ message: "refreshToken yaroqli JWT bo'lishi kerak" })
  refreshToken!: string;
}
