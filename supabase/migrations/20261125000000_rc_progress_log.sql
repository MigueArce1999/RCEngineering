-- Registro de avance físico real (para el análisis de valor ganado).
-- Cada fila: "a esta fecha la obra llevaba X % de avance". Lectura con project.view, escritura con finance.manage.
create table public.progress_log (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  date date not null,
  pct numeric not null check (pct >= 0 and pct <= 1),
  note text not null default '' check (length(note) <= 280),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index progress_log_project_idx on public.progress_log (project_id, date);
alter table public.progress_log enable row level security;
create policy "progress_log_read" on public.progress_log for select to authenticated using (public.has_permission('project.view'));
create policy "progress_log_insert" on public.progress_log for insert to authenticated with check (public.has_permission('finance.manage'));
create policy "progress_log_update" on public.progress_log for update to authenticated using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
create policy "progress_log_delete" on public.progress_log for delete to authenticated using (public.has_permission('finance.manage'));
grant select, insert, update, delete on public.progress_log to authenticated;
