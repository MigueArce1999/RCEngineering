-- RC Engineering OS · Nómina de obra (quincenal / mensual)
-- Datos sensibles: lectura y escritura solo con el permiso payroll.manage.

insert into public.permissions (id, name, description, sort_order)
values ('payroll.manage', 'Gestionar nómina', 'Ver y liquidar la nómina de obra (salarios y pagos).', 7)
on conflict (id) do nothing;
insert into public.role_permissions (role_id, permission_id) values
  ('admin', 'payroll.manage'), ('director', 'payroll.manage'), ('budget', 'payroll.manage')
on conflict do nothing;

create table public.workers (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  document text not null default '',
  role text not null,
  daily_rate bigint not null default 0 check (daily_rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index workers_project_idx on public.workers (project_id, active);

create table public.payroll_periods (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('biweekly', 'monthly')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at date,
  -- Gasto creado en Finanzas al pagar (se elimina si se reabre)
  expense_id text references public.expenses (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index payroll_periods_project_idx on public.payroll_periods (project_id, start_date desc);

create table public.payroll_entries (
  id text primary key,
  period_id text not null references public.payroll_periods (id) on delete cascade,
  worker_id text references public.workers (id) on delete set null,
  -- Copia del nombre y cargo: la liquidación conserva lo pagado aunque el trabajador cambie
  worker_name text not null,
  role text not null,
  days numeric not null default 0 check (days >= 0 and days <= 31),
  daily_rate bigint not null default 0 check (daily_rate >= 0),
  extras bigint not null default 0 check (extras >= 0),
  deductions bigint not null default 0 check (deductions >= 0),
  sort_order int not null default 0
);
create index payroll_entries_period_idx on public.payroll_entries (period_id, sort_order);

alter table public.workers enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workers', 'payroll_periods', 'payroll_entries'] loop
    execute format('create policy "%s_all" on public.%I for all to authenticated using (public.has_permission(''payroll.manage'')) with check (public.has_permission(''payroll.manage''))', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.workers, public.payroll_periods, public.payroll_entries to authenticated;

-- Quien gestiona la nómina debe poder registrar/eliminar el gasto de nómina en Finanzas
drop policy if exists "expenses_insert" on public.expenses;
drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_insert" on public.expenses for insert to authenticated
  with check (public.has_permission('finance.manage') or public.has_permission('payroll.manage'));
create policy "expenses_delete" on public.expenses for delete to authenticated
  using (public.has_permission('finance.manage') or public.has_permission('payroll.manage'));
