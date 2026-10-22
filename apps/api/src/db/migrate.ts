import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './db.module';

export async function migrate() {
  const dir = join(__dirname, '..', '..', 'migrations');
  const client = await pool.connect();
  try {
    await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())');
    const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => r.name));
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (done.has(f)) continue;
      console.log('migration', f);
      await client.query('begin');
      try {
        await client.query(readFileSync(join(dir, f), 'utf8'));
        await client.query('insert into schema_migrations(name) values ($1)', [f]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }
  } finally {
    client.release();
  }
}
