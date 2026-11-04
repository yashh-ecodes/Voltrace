-- Voltrace Supabase / PostgreSQL schema
-- Apply in the Supabase SQL editor, then set SUPABASE_URL and SUPABASE_SERVICE_KEY
-- for the FastAPI service. The service role key must only be used server-side.

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text check (kind in ('fleet','workshop','dealer','lender','individual')) default 'fleet',
  created_at timestamptz default now()
);

create table if not exists public.batteries (
  battery_id text primary key,              -- BPAN or temporary Voltrace ID
  organisation_id uuid references public.organisations(id),
  category text,
  chemistry text,
  series_cells int,
  nominal_v numeric,
  rated_ah numeric,
  vehicle_type text,
  vehicle_reg text,
  created_at timestamptz default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  battery_id text references public.batteries(battery_id),
  source text,                               -- 'ble:jbd' | 'ble:daly' | 'demo-profile:*'
  reading jsonb not null,                    -- raw BMS snapshot + load-test samples
  features jsonb not null,                   -- engineered features sent to the model
  soh numeric, soh_low numeric, soh_high numeric,
  safety_flag text check (safety_flag in ('GREEN','AMBER','RED')),
  suspect_cell int,
  created_at timestamptz default now()
);

create table if not exists public.passports (
  pid text primary key,
  battery_id text,
  payload jsonb not null,                    -- the exact signed JSON object
  hash text not null,                        -- SHA-256 of canonical JSON
  sig text not null,                         -- Ed25519 signature (hex)
  kid text not null,                         -- issuer key id
  created_at timestamptz default now()
);

create index if not exists scans_battery_idx on public.scans(battery_id, created_at desc);
create index if not exists passports_battery_idx on public.passports(battery_id);

-- Public verification only needs read access to passports.
alter table public.passports enable row level security;
create policy "passports are publicly readable" on public.passports for select using (true);
alter table public.scans enable row level security;
alter table public.batteries enable row level security;
alter table public.organisations enable row level security;
