-- RC Engineering OS · esquema inicial
-- Lectura pública (anon + authenticated); escritura solo para usuarios en public.editors.

create extension if not exists pgcrypto;

-- ── Catálogos y proyecto ────────────────────────────────────────────────
create table public.projects (
  id text primary key,
  code text not null unique,
  name text not null,
  city text not null,
  country text not null,
  type text not null,
  built_area_m2 numeric not null,
  levels int not null,
  structural_system text not null,
  status text not null check (status in ('active', 'paused', 'closed')),
  start_date date not null,
  planned_end_date date not null,
  has_demo_data boolean not null default false,
  approved_budget bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.members (
  id text primary key,
  name text not null,
  role text not null,
  initials text not null
);

create table public.stages (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  sort_order int not null,
  name text not null,
  icon text not null default 'generic' check (icon in ('survey', 'design', 'build', 'finish', 'generic')),
  weight numeric not null default 0.1 check (weight >= 0),
  created_at timestamptz not null default now()
);
create index stages_project_idx on public.stages (project_id, sort_order);

create table public.tasks (
  id text primary key,
  stage_id text not null references public.stages (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  assignee_id text references public.members (id) on delete set null,
  due_date date not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  category text not null default '',
  element_ids text[] not null default '{}',
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index tasks_stage_idx on public.tasks (stage_id, sort_order);
create index tasks_due_idx on public.tasks (due_date) where status <> 'done';

create table public.task_notes (
  id text primary key default gen_random_uuid()::text,
  task_id text not null references public.tasks (id) on delete cascade,
  text text not null check (length(text) between 1 and 4000),
  author_id text references public.members (id) on delete set null,
  author_user uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index task_notes_task_idx on public.task_notes (task_id, created_at);

create table public.materials (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  name text not null,
  spec text not null default '',
  unit text not null,
  planned_qty numeric not null default 0,
  received_qty numeric not null default 0,
  consumed_qty numeric not null default 0,
  unit_price bigint not null default 0,
  min_stock numeric not null default 0,
  supplier text not null default '',
  sort_order int not null default 0
);

create table public.inventory_movements (
  id text primary key,
  material_id text not null references public.materials (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  qty numeric not null,
  date date not null,
  reference text not null default ''
);

create table public.quotes (
  id text primary key,
  code text not null,
  project_id text not null references public.projects (id) on delete cascade,
  client_name text not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  created_at date not null default current_date,
  adjustments jsonb not null,
  notes text not null default '',
  created_by uuid default auth.uid()
);
create index quotes_project_idx on public.quotes (project_id, created_at);

create table public.quote_items (
  id text primary key,
  quote_id text not null references public.quotes (id) on delete cascade,
  sort_order int not null default 0,
  description text not null,
  category text not null check (category in ('materials', 'labor', 'equipment', 'other')),
  unit text not null,
  quantity numeric not null check (quantity >= 0),
  unit_price numeric not null check (unit_price >= 0)
);
create index quote_items_quote_idx on public.quote_items (quote_id, sort_order);

create table public.expenses (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  date date not null,
  concept text not null,
  category text not null check (category in ('materials', 'labor', 'equipment', 'other')),
  amount bigint not null
);

create table public.planned_curve (
  project_id text not null references public.projects (id) on delete cascade,
  date date not null,
  amount bigint not null,
  primary key (project_id, date)
);

create table public.blueprints (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  code text not null,
  title text not null,
  category text not null,
  level text not null,
  format text not null,
  src text not null,
  revision text not null,
  illustrative boolean not null default true,
  sort_order int not null default 0
);

-- ── Editores autorizados ────────────────────────────────────────────────
-- Solo los correos de esta tabla pueden modificar datos. Agrega editores con:
--   insert into public.editors (email) values ('persona@empresa.com');
create table public.editors (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editors e
    where e.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- Marca de actualización
create or replace function public.touch_task()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_task();

-- ── Row Level Security ──────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'members', 'stages', 'tasks', 'task_notes', 'materials',
    'inventory_movements', 'quotes', 'quote_items', 'expenses', 'planned_curve', 'blueprints'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_read" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;

  -- Tablas que la app modifica: solo editores
  foreach t in array array['stages', 'tasks', 'task_notes', 'quotes', 'quote_items'] loop
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (public.is_editor())', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using (public.is_editor())', t, t);
  end loop;
end
$$;

-- La lista de editores no es pública: cada usuario solo ve si él mismo es editor
alter table public.editors enable row level security;
create policy "editors_self_read" on public.editors for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));
