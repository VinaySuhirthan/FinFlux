import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
      select: { id: true, email: true, name: true },
    });

    const token = this.sign(user.id, user.email);
    return { user, token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    this.logger.debug(`Login attempt for ${dto.email}, password length: ${dto.password.length}`);
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    this.logger.debug(`Password valid: ${valid}`);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.sign(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    };
  }

  private sign(userId: string, email: string) {
    return this.jwt.sign({ sub: userId, email });
  }
}
