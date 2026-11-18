-- RC Engineering OS · usuarios, roles y permisos
-- Reemplaza la lista simple de editores por perfiles con rol y permisos por rol.
-- La app exige iniciar sesión: los visitantes anónimos ya no leen datos.

-- ── Roles y permisos ────────────────────────────────────────────────────
create table public.roles (
  id text primary key,
  name text not null,
  description text not null,
  sort_order int not null
);

create table public.permissions (
  id text primary key,
  name text not null,
  description text not null,
  sort_order int not null
);

create table public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

insert into public.roles (id, name, description, sort_order) values
  ('admin', 'Administrador', 'Control total: gestiona usuarios, roles y todos los módulos.', 1),
  ('director', 'Director de proyecto', 'Planifica etapas, gestiona actividades y aprueba cotizaciones.', 2),
  ('engineer', 'Ingeniero / Residente', 'Ejecuta y actualiza actividades y registra observaciones de obra.', 3),
  ('budget', 'Presupuestos', 'Elabora y edita cotizaciones y análisis de precios.', 4),
  ('viewer', 'Consulta', 'Solo lectura de todo el proyecto. Rol inicial de las cuentas nuevas.', 5);

insert into public.permissions (id, name, description, sort_order) values
  ('project.view', 'Ver proyecto', 'Consultar dashboard, 3D, planos, materiales y finanzas.', 1),
  ('tasks.edit', 'Gestionar actividades', 'Cambiar estado, crear actividades y agregar observaciones.', 2),
  ('stages.manage', 'Gestionar etapas', 'Crear, renombrar y reordenar etapas.', 3),
  ('quotes.manage', 'Gestionar cotizaciones', 'Crear y editar cotizaciones.', 4),
  ('users.manage', 'Gestionar usuarios', 'Ver usuarios y asignar roles.', 5);

insert into public.role_permissions (role_id, permission_id) values
  ('admin', 'project.view'), ('admin', 'tasks.edit'), ('admin', 'stages.manage'), ('admin', 'quotes.manage'), ('admin', 'users.manage'),
  ('director', 'project.view'), ('director', 'tasks.edit'), ('director', 'stages.manage'), ('director', 'quotes.manage'),
  ('engineer', 'project.view'), ('engineer', 'tasks.edit'),
  ('budget', 'project.view'), ('budget', 'quotes.manage'),
  ('viewer', 'project.view');

-- ── Perfiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  role_id text not null default 'viewer' references public.roles (id),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role_id);

-- Administradores iniciales: correos que reciben el rol admin al registrarse (uso único).
-- Se llena desde el SQL Editor; sin políticas, así que la app no puede leerla ni modificarla.
create table public.admin_bootstrap (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_bootstrap enable row level security;
revoke all on public.admin_bootstrap from anon, authenticated;

-- Crea el perfil al registrarse (nombre y apellido vienen en los metadatos del registro)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text := 'viewer';
begin
  delete from public.admin_bootstrap where email = lower(new.email) returning 'admin' into initial_role;
  insert into public.profiles (id, email, first_name, last_name, role_id, terms_accepted_at)
  values (
    new.id,
    lower(new.email),
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 80),
    coalesce(initial_role, 'viewer'),
    case when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para cuentas que ya existieran antes de esta migración
insert into public.profiles (id, email)
select id, lower(email) from auth.users
on conflict (id) do nothing;

-- Quienes estaban en la lista de editores pasan a director
update public.profiles p set role_id = 'director'
from public.editors e where e.email = p.email;

-- ── Funciones de permiso ────────────────────────────────────────────────
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and rp.permission_id = perm
  );
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

-- Asignar rol: solo con users.manage, y nadie puede cambiarse su propio rol
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'No tienes permiso para gestionar usuarios';
  end if;
  if target = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  if not exists (select 1 from public.roles where id = new_role) then
    raise exception 'Rol inexistente: %', new_role;
  end if;
  update public.profiles set role_id = new_role where id = target;
end;
$$;
revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ── Políticas: lectura solo autenticados con project.view ───────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'members', 'stages', 'tasks', 'task_notes', 'materials',
    'inventory_movements', 'quotes', 'quote_items', 'expenses', 'planned_curve', 'blueprints'
  ] loop
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (public.has_permission(''project.view''))', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;

  foreach t in array array['stages', 'tasks', 'task_notes', 'quotes', 'quote_items'] loop
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
  end loop;
end
$$;

-- Etapas
create policy "stages_write" on public.stages for insert to authenticated with check (public.has_permission('stages.manage'));
create policy "stages_update" on public.stages for update to authenticated using (public.has_permission('stages.manage')) with check (public.has_permission('stages.manage'));
create policy "stages_delete" on public.stages for delete to authenticated using (public.has_permission('stages.manage'));
-- Actividades y observaciones
create policy "tasks_insert" on public.tasks for insert to authenticated with check (public.has_permission('tasks.edit'));
create policy "tasks_update" on public.tasks for update to authenticated using (public.has_permission('tasks.edit')) with check (public.has_permission('tasks.edit'));
create policy "tasks_delete" on public.tasks for delete to authenticated using (public.has_permission('stages.manage'));
create policy "task_notes_insert" on public.task_notes for insert to authenticated with check (public.has_permission('tasks.edit') and author_user = auth.uid());
create policy "task_notes_delete" on public.task_notes for delete to authenticated using (author_user = auth.uid() or public.has_permission('users.manage'));
-- Cotizaciones
create policy "quotes_insert" on public.quotes for insert to authenticated with check (public.has_permission('quotes.manage'));
create policy "quotes_update" on public.quotes for update to authenticated using (public.has_permission('quotes.manage')) with check (public.has_permission('quotes.manage'));
create policy "quotes_delete" on public.quotes for delete to authenticated using (public.has_permission('quotes.manage'));
create policy "quote_items_insert" on public.quote_items for insert to authenticated with check (public.has_permission('quotes.manage'));
create policy "quote_items_update" on public.quote_items for update to authenticated using (public.has_permission('quotes.manage')) with check (public.has_permission('quotes.manage'));
create policy "quote_items_delete" on public.quote_items for delete to authenticated using (public.has_permission('quotes.manage'));

-- Roles, permisos y perfiles
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
create policy "roles_read" on public.roles for select to authenticated using (true);
create policy "permissions_read" on public.permissions for select to authenticated using (true);
create policy "role_permissions_read" on public.role_permissions for select to authenticated using (true);
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('users.manage'));
-- Cada usuario edita solo su nombre (el rol se cambia con set_user_role)
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select on public.roles, public.permissions, public.role_permissions, public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;

-- La lista de editores queda reemplazada por los roles
drop policy if exists "editors_self_read" on public.editors;
drop table public.editors;
drop function if exists public.is_editor();
