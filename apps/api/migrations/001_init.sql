create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','gerente','almacen','repartidor')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_ar text,
  category text,
  unit text not null default 'kg' check (unit in ('kg','piece')),
  shelf_life_days int,
  price numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ice text,
  phone text,
  onssa_approval text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ice text,
  address text,
  phone text,
  gps_lat numeric(9,6),
  gps_lng numeric(9,6),
  payment_terms text,
  credit_limit numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un vehicule est une location de stock (type VEHICULE)
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('DEPOT','CHAMBRE_FROIDE','VEHICULE')),
  plate text,
  target_temp numeric(4,1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create sequence lot_seq;

create table lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id uuid not null references products(id),
  supplier_id uuid references suppliers(id),
  slaughter_date date,
  received_at timestamptz not null default now(),
  expiry_date date,
  temperature numeric(4,1)
);

-- Livre de mouvements : le stock n'est jamais modifie, seulement calcule
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  product_id uuid not null references products(id),
  qty_kg numeric(12,3) not null default 0,
  qty_pieces int not null default 0,
  from_location uuid references locations(id),
  to_location uuid references locations(id),
  type text not null check (type in ('RECEPTION','TRANSFERT','PERTE','AJUSTEMENT')),
  note text,
  user_id uuid references users(id),
  created_at timestamptz not null default now(),
  check (from_location is not null or to_location is not null),
  check (qty_kg >= 0 and qty_pieces >= 0 and (qty_kg > 0 or qty_pieces > 0))
);
create index on stock_movements (lot_id);
create index on stock_movements (created_at desc);

create function forbid_change() returns trigger as $$
begin
  raise exception 'stock_movements est immuable : corrigez par un mouvement d''ajustement';
end;
$$ language plpgsql;

create trigger stock_movements_immutable
  before update or delete on stock_movements
  for each row execute function forbid_change();

create view stock_balance as
select lot_id, product_id, location_id, sum(kg) as kg, sum(pieces) as pieces
from (
  select lot_id, product_id, to_location as location_id, qty_kg as kg, qty_pieces as pieces
    from stock_movements where to_location is not null
  union all
  select lot_id, product_id, from_location, -qty_kg, -qty_pieces
    from stock_movements where from_location is not null
) t
group by lot_id, product_id, location_id
having sum(kg) <> 0 or sum(pieces) <> 0;
