import {
  BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Injectable,
  OnModuleInit, Post, Req, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PG } from '../db/db.module';

export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride('public', targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const h: string = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      req.user = this.jwt.verify(h.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    const roles = this.reflector.getAllAndOverride<string[]>('roles', targets);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('Droits insuffisants');
    return true;
  }
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(@Inject(PG) private pool: Pool, private jwt: JwtService) {}

  // Cree le premier administrateur depuis les variables d'environnement
  async onModuleInit() {
    const n = (await this.pool.query('select count(*)::int n from users')).rows[0].n;
    if (n > 0) return;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn('Aucun utilisateur : definissez ADMIN_EMAIL et ADMIN_PASSWORD');
      return;
    }
    await this.pool.query('insert into users(name,email,password_hash,role) values ($1,$2,$3,$4)', [
      process.env.ADMIN_NAME || 'Administrateur', email.toLowerCase(), await bcrypt.hash(password, 10), 'admin',
    ]);
    console.log('Administrateur cree :', email);
  }

  async login(email: string, password: string) {
    const r = await this.pool.query('select * from users where email=$1 and active', [String(email || '').toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const user = { id: u.id, name: u.name, email: u.email, role: u.role };
    return { token: this.jwt.sign(user), user };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() b: any) {
    if (!b?.email || !b?.password) throw new BadRequestException('Email et mot de passe requis');
    return this.auth.login(b.email, b.password);
  }

  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }
}
