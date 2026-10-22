import { BadRequestException, Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG } from '../db/db.module';
import { Roles } from '../auth/auth';

const STOCK_ROLES = ['admin', 'gerente', 'almacen'];
const num = (v: any) => (v === undefined || v === null || v === '' ? 0 : Number(v));

@Controller('stock')
export class StockController {
  constructor(@Inject(PG) private pool: Pool) {}

  // Stock actuel par lot et emplacement
  @Get()
  async balance() {
    return (
      await this.pool.query(`
        select b.lot_id, l.code as lot_code, l.expiry_date, b.product_id, p.name_fr as product, p.unit,
               b.location_id, loc.name as location, b.kg, b.pieces
        from stock_balance b
        join lots l on l.id = b.lot_id
        join products p on p.id = b.product_id
        join locations loc on loc.id = b.location_id
        order by p.name_fr, l.expiry_date nulls last`)
    ).rows;
  }

  @Get('movements')
  async movements(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(parseInt(limit || '100', 10) || 100, 1), 500);
    return (
      await this.pool.query(
        `select m.id, m.created_at, m.type, m.qty_kg, m.qty_pieces, m.note, l.code as lot_code, p.name_fr as product,
                f.name as from_location, t.name as to_location, u.name as user_name
         from stock_movements m
         join lots l on l.id = m.lot_id
         join products p on p.id = m.product_id
         left join locations f on f.id = m.from_location
         left join locations t on t.id = m.to_location
         left join users u on u.id = m.user_id
         order by m.created_at desc limit $1`, [n])
    ).rows;
  }

  @Get('summary')
  async summary() {
    const r = await this.pool.query(`
      select
        coalesce((select sum(kg) from stock_balance),0)::float as total_kg,
        (select count(distinct lot_id) from stock_balance)::int as active_lots,
        (select count(distinct lot_id) from stock_balance b join lots l on l.id=b.lot_id
           where l.expiry_date is not null and l.expiry_date <= current_date + 3)::int as expiring_lots`);
    return r.rows[0];
  }

  // Reception d'un arrivage : cree un lot et le mouvement d'entree
  @Post('receive')
  @Roles(...STOCK_ROLES)
  async receive(@Body() b: any, @Req() req: any) {
    const kg = num(b.qty_kg), pcs = num(b.qty_pieces);
    if (!b.product_id || !b.location_id) throw new BadRequestException('Produit et emplacement requis');
    if (!(kg > 0 || pcs > 0)) throw new BadRequestException('Quantite requise');
    return this.tx(async (c) => {
      const lot = (
        await c.query(
          `insert into lots (code, product_id, supplier_id, slaughter_date, expiry_date, temperature)
           values ('L'||to_char(now(),'YYMMDD')||'-'||lpad(nextval('lot_seq')::text,4,'0'), $1,$2,$3,$4,$5) returning *`,
          [b.product_id, b.supplier_id || null, b.slaughter_date || null, b.expiry_date || null, b.temperature === '' ? null : b.temperature ?? null])
      ).rows[0];
      await c.query(
        `insert into stock_movements (lot_id, product_id, qty_kg, qty_pieces, to_location, type, note, user_id)
         values ($1,$2,$3,$4,$5,'RECEPTION',$6,$7)`,
        [lot.id, b.product_id, kg, Math.round(pcs), b.location_id, b.note || null, req.user.id]);
      return lot;
    });
  }

  // Transfert entre emplacements, ou perte (sans destination). Refuse si le stock est insuffisant.
  @Post('move')
  @Roles(...STOCK_ROLES)
  async move(@Body() b: any, @Req() req: any) {
    const kg = num(b.qty_kg), pcs = Math.round(num(b.qty_pieces));
    const type = b.type === 'PERTE' ? 'PERTE' : 'TRANSFERT';
    if (!b.lot_id || !b.from_location) throw new BadRequestException('Lot et emplacement source requis');
    if (!(kg > 0 || pcs > 0)) throw new BadRequestException('Quantite requise');
    if (type === 'TRANSFERT' && (!b.to_location || b.to_location === b.from_location))
      throw new BadRequestException('Destination invalide');
    if (type === 'PERTE' && !b.note) throw new BadRequestException('Motif obligatoire pour une perte');
    return this.tx(async (c) => {
      await c.query('select pg_advisory_xact_lock(hashtext($1))', [b.lot_id + b.from_location]);
      const bal = (
        await c.query('select kg, pieces from stock_balance where lot_id=$1 and location_id=$2', [b.lot_id, b.from_location])
      ).rows[0];
      if (!bal || Number(bal.kg) < kg || Number(bal.pieces) < pcs) throw new BadRequestException('Stock insuffisant dans cet emplacement');
      const lot = (await c.query('select product_id from lots where id=$1', [b.lot_id])).rows[0];
      return (
        await c.query(
          `insert into stock_movements (lot_id, product_id, qty_kg, qty_pieces, from_location, to_location, type, note, user_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
          [b.lot_id, lot.product_id, kg, pcs, b.from_location, type === 'PERTE' ? null : b.to_location, type, b.note || null, req.user.id])
      ).rows[0];
    });
  }

  private async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      const r = await fn(c);
      await c.query('commit');
      return r;
    } catch (e: any) {
      await c.query('rollback');
      if (['22P02', '23503', '22007', '22003', '23514'].includes(e.code)) throw new BadRequestException('Valeur invalide');
      throw e;
    } finally {
      c.release();
    }
  }
}
