-- RC Engineering OS · proyectos reales y asistente "Completa tu proyecto"
-- 1) Borra los datos de demostración (los usuarios, perfiles y roles se conservan).
-- 2) Agrega campos de proyecto, permisos por área y escritura en los módulos que se llenan desde la app.

-- ── 1. Reinicio de datos de demostración ────────────────────────────────
delete from public.projects;   -- en cascada: etapas, actividades, notas, materiales, movimientos, cotizaciones, gastos, curva, planos
delete from public.members;

-- ── 2. Proyecto: campos nuevos ──────────────────────────────────────────
alter table public.projects
  add column client_name text not null default '',
  add column description text not null default '',
  add column currency text not null default 'COP',
  add column setup_skipped text[] not null default '{}',
  add column created_by uuid default auth.uid();
alter table public.projects alter column has_demo_data set default true;
alter table public.projects alter column built_area_m2 set default 0;
alter table public.projects alter column levels set default 1;
alter table public.projects alter column structural_system set default '';

alter table public.members add column project_id text references public.projects (id) on delete cascade;
alter table public.members add column profile_id uuid references public.profiles (id) on delete set null;
create index members_project_idx on public.members (project_id);

-- ── 3. Permisos por área ────────────────────────────────────────────────
insert into public.permissions (id, name, description, sort_order) values
  ('projects.manage', 'Gestionar proyectos', 'Crear proyectos, editar sus datos generales y su equipo.', 2),
  ('finance.manage', 'Gestionar finanzas', 'Definir presupuesto y registrar gastos.', 6),
  ('inventory.manage', 'Gestionar materiales e inventario', 'Registrar materiales, entradas y salidas de bodega.', 7)
on conflict (id) do nothing;
update public.permissions set sort_order = 8 where id = 'users.manage';

insert into public.role_permissions (role_id, permission_id) values
  ('admin', 'projects.manage'), ('admin', 'finance.manage'), ('admin', 'inventory.manage'),
  ('director', 'projects.manage'), ('director', 'finance.manage'), ('director', 'inventory.manage'),
  ('engineer', 'inventory.manage'),
  ('budget', 'finance.manage')
on conflict do nothing;

-- ── 4. Inventario: recibido y consumido se calculan desde los movimientos ─
create or replace function public.sync_material_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mid text := coalesce(new.material_id, old.material_id);
begin
  update public.materials m set
    received_qty = coalesce((select sum(qty) from public.inventory_movements where material_id = mid and type = 'in'), 0),
    consumed_qty = coalesce((select sum(qty) from public.inventory_movements where material_id = mid and type = 'out'), 0)
  where m.id = mid;
  return null;
end;
$$;
create trigger inventory_movements_sync after insert or update or delete on public.inventory_movements
  for each row execute function public.sync_material_stock();

-- ── 5. Políticas de escritura ───────────────────────────────────────────
create policy "projects_insert" on public.projects for insert to authenticated with check (public.has_permission('projects.manage'));
create policy "projects_update" on public.projects for update to authenticated using (public.has_permission('projects.manage') or public.has_permission('finance.manage')) with check (public.has_permission('projects.manage') or public.has_permission('finance.manage'));
create policy "projects_delete" on public.projects for delete to authenticated using (public.has_permission('users.manage'));

create policy "members_insert" on public.members for insert to authenticated with check (public.has_permission('projects.manage'));
create policy "members_update" on public.members for update to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy "members_delete" on public.members for delete to authenticated using (public.has_permission('projects.manage'));

create policy "expenses_insert" on public.expenses for insert to authenticated with check (public.has_permission('finance.manage'));
create policy "expenses_update" on public.expenses for update to authenticated using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
create policy "expenses_delete" on public.expenses for delete to authenticated using (public.has_permission('finance.manage'));
create policy "planned_curve_insert" on public.planned_curve for insert to authenticated with check (public.has_permission('finance.manage'));
create policy "planned_curve_update" on public.planned_curve for update to authenticated using (public.has_permission('finance.manage')) with check (public.has_permission('finance.manage'));
create policy "planned_curve_delete" on public.planned_curve for delete to authenticated using (public.has_permission('finance.manage'));

create policy "materials_insert" on public.materials for insert to authenticated with check (public.has_permission('inventory.manage'));
create policy "materials_update" on public.materials for update to authenticated using (public.has_permission('inventory.manage')) with check (public.has_permission('inventory.manage'));
create policy "materials_delete" on public.materials for delete to authenticated using (public.has_permission('inventory.manage'));
create policy "inventory_movements_insert" on public.inventory_movements for insert to authenticated with check (public.has_permission('inventory.manage'));
create policy "inventory_movements_delete" on public.inventory_movements for delete to authenticated using (public.has_permission('inventory.manage'));

grant insert, update, delete on public.projects, public.members, public.expenses, public.planned_curve, public.materials to authenticated;
grant insert, delete on public.inventory_movements to authenticated;
