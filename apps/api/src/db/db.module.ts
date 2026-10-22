import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const PG = 'PG';
export const pool = new Pool(); // lit PGHOST, PGUSER, PGPASSWORD, PGDATABASE

@Global()
@Module({
  providers: [{ provide: PG, useValue: pool }],
  exports: [PG],
})
export class DbModule {}
