import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from './db/db.module';
import { AuthController, AuthGuard, AuthService } from './auth/auth';
import { crudController } from './crud/crud';
import { StockController } from './stock/stock.controller';
import { HealthController } from './health.controller';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16) throw new Error('JWT_SECRET manquant ou trop court (min 16 caracteres)');

const MANAGE = ['admin', 'gerente'];
const STOCK = ['admin', 'gerente', 'almacen'];

@Module({
  imports: [DbModule, JwtModule.register({ global: true, secret, signOptions: { expiresIn: '12h' } })],
  controllers: [
    HealthController,
    AuthController,
    StockController,
    crudController('products', 'products', ['name_fr', 'name_ar', 'category', 'unit', 'shelf_life_days', 'price'], ['name_fr'], STOCK),
    crudController('suppliers', 'suppliers', ['name', 'ice', 'phone', 'onssa_approval', 'notes'], ['name'], STOCK),
    crudController('customers', 'customers', ['name', 'ice', 'address', 'phone', 'gps_lat', 'gps_lng', 'payment_terms', 'credit_limit'], ['name'], STOCK),
    crudController('locations', 'locations', ['name', 'type', 'plate', 'target_temp'], ['name', 'type'], MANAGE),
  ],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
