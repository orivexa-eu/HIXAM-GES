import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Pool } from 'pg';
import { PG } from '../db/db.module';
import { Roles } from '../auth/auth';

// Controleur CRUD generique : lecture pour tous, ecriture selon les roles. Suppression = desactivation.
export function crudController(path: string, table: string, fields: string[], required: string[], writeRoles: string[]) {
  const clean = (b: any) => {
    const out: Record<string, any> = {};
    for (const f of fields) if (b && f in b) out[f] = b[f] === '' ? null : b[f];
    return out;
  };

  @Controller(path)
  class CrudController {
    constructor(@Inject(PG) private pool: Pool) {}

    @Get()
    async list() {
      return (await this.pool.query(`select * from ${table} where active order by created_at desc`)).rows;
    }

    @Post()
    @Roles(...writeRoles)
    async create(@Body() b: any) {
      const d = clean(b);
      for (const r of required) if (d[r] == null) throw new BadRequestException(`Champ requis : ${r}`);
      const keys = Object.keys(d);
      const sql = `insert into ${table} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`;
      return (await this.query(sql, Object.values(d))).rows[0];
    }

    @Put(':id')
    @Roles(...writeRoles)
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
      const d = clean(b);
      for (const r of required) if (r in d && d[r] == null) throw new BadRequestException(`Champ requis : ${r}`);
      const keys = Object.keys(d);
      if (!keys.length) throw new BadRequestException('Rien a modifier');
      const sql = `update ${table} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} where id=$${keys.length + 1} and active returning *`;
      const r = await this.query(sql, [...Object.values(d), id]);
      if (!r.rows[0]) throw new NotFoundException();
      return r.rows[0];
    }

    @Delete(':id')
    @Roles(...writeRoles)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
      const r = await this.pool.query(`update ${table} set active=false where id=$1 and active returning id`, [id]);
      if (!r.rows[0]) throw new NotFoundException();
      return { ok: true };
    }

    private async query(sql: string, params: any[]) {
      try {
        return await this.pool.query(sql, params);
      } catch (e: any) {
        if (['22P02', '23514', '23502', '23503', '22007', '22003'].includes(e.code)) throw new BadRequestException('Valeur invalide');
        throw e;
      }
    }
  }
  return CrudController;
}
