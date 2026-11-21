-- RC Engineering OS · Planos reales, fotos de obra y acceso de invitados
--
-- 1) Planos: cada plano es un archivo (PDF o imagen) en el bucket privado project-blueprints.
-- 2) Fotos de obra: registro fotográfico por fecha y etapa en el bucket privado project-photos.
-- 3) Invitados: enlaces con token (sin cuenta) que muestran información básica, avance,
--    planos, fotos y el modelo 3D según lo que se active en cada enlace.
--    · Datos: función guest_view(token), que solo devuelve lo permitido (nunca finanzas ni nómina).
--    · Archivos: el cliente del invitado envía el token en la cabecera x-guest-token y las
--      políticas de Storage lo validan; sin token válido no se lee nada.

-- ── Permiso nuevo ───────────────────────────────────────────────────────
insert into public.permissions (id, name, description, sort_order)
values ('documents.manage', 'Gestionar planos y fotos', 'Cargar, editar y eliminar planos y fotos de obra.', 6)
on conflict (id) do nothing;
insert into public.role_permissions (role_id, permission_id) values
  ('admin', 'documents.manage'), ('director', 'documents.manage'), ('engineer', 'documents.manage')
on conflict do nothing;

-- ── 1. Planos ───────────────────────────────────────────────────────────
alter table public.blueprints
  add column file_path text,
  add column file_name text not null default '',
  add column file_size bigint not null default 0,
  add column mime text not null default '',
  add column notes text not null default '',
  add column uploaded_at timestamptz not null default now(),
  add column uploaded_by uuid default auth.uid();
alter table public.blueprints alter column illustrative set default false;
alter table public.blueprints alter column src set default '';
alter table public.blueprints alter column level set default 'General';
alter table public.blueprints alter column revision set default 'R0';
create index if not exists blueprints_project_idx on public.blueprints (project_id, sort_order);

create policy "blueprints_insert" on public.blueprints for insert to authenticated with check (public.has_permission('documents.manage'));
create policy "blueprints_update" on public.blueprints for update to authenticated using (public.has_permission('documents.manage')) with check (public.has_permission('documents.manage'));
create policy "blueprints_delete" on public.blueprints for delete to authenticated using (public.has_permission('documents.manage'));
grant insert, update, delete on public.blueprints to authenticated;

-- ── 2. Fotos de obra ────────────────────────────────────────────────────
create table public.site_photos (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  stage_id text references public.stages (id) on delete set null,
  file_path text not null,
  thumb_path text not null,
  caption text not null default '' check (length(caption) <= 280),
  taken_at date not null default current_date,
  width int not null default 0,
  height int not null default 0,
  created_at timestamptz not null default now(),
  uploaded_by uuid default auth.uid()
);
create index site_photos_project_idx on public.site_photos (project_id, taken_at desc);
alter table public.site_photos enable row level security;
create policy "site_photos_read" on public.site_photos for select to authenticated using (public.has_permission('project.view'));
create policy "site_photos_insert" on public.site_photos for insert to authenticated with check (public.has_permission('documents.manage'));
create policy "site_photos_update" on public.site_photos for update to authenticated using (public.has_permission('documents.manage')) with check (public.has_permission('documents.manage'));
create policy "site_photos_delete" on public.site_photos for delete to authenticated using (public.has_permission('documents.manage'));
grant select, insert, update, delete on public.site_photos to authenticated;

-- ── 3. Enlaces de invitado ──────────────────────────────────────────────
create table public.project_shares (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects (id) on delete cascade,
  -- 32 bytes aleatorios en base64url: imposible de adivinar
  token text not null unique default translate(rtrim(encode(gen_random_bytes(32), 'base64'), '='), '+/', '-_'),
  label text not null default '' check (length(label) <= 120),
  show_progress boolean not null default true,
  show_model boolean not null default true,
  show_photos boolean not null default true,
  show_blueprints boolean not null default true,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index project_shares_project_idx on public.project_shares (project_id, created_at desc);
alter table public.project_shares enable row level security;
create policy "project_shares_all" on public.project_shares for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
grant select, insert, update, delete on public.project_shares to authenticated;
-- El token no se puede reescribir: para cambiarlo se revoca y se crea otro enlace
revoke update on public.project_shares from authenticated;
grant update (label, show_progress, show_model, show_photos, show_blueprints, expires_at, revoked_at) on public.project_shares to authenticated;

-- Enlace activo a partir de un token (vigente y no revocado)
create or replace function public.active_share(p_token text)
returns public.project_shares
language sql
stable
security definer
set search_path = public
as $$
  select s.* from public.project_shares s
  where p_token is not null and length(p_token) >= 32 and s.token = p_token
    and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;
revoke all on function public.active_share(text) from public;

-- ¿El invitado (token en la cabecera x-guest-token) puede leer este archivo?
-- La ruta de todo archivo empieza por el id del proyecto: {project_id}/...
create or replace function public.guest_can_read(p_bucket text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.project_shares;
  tok text := nullif(current_setting('request.headers', true), '')::json ->> 'x-guest-token';
begin
  if tok is null then
    return false;
  end if;
  s := public.active_share(tok);
  if s.id is null or split_part(p_name, '/', 1) <> s.project_id then
    return false;
  end if;
  return case p_bucket
    when 'project-blueprints' then s.show_blueprints
    when 'project-photos' then s.show_photos
    when 'project-models' then s.show_model
    else false
  end;
end;
$$;
revoke all on function public.guest_can_read(text, text) from public;
grant execute on function public.guest_can_read(text, text) to anon, authenticated;

-- Vista del invitado: solo información básica y lo habilitado en el enlace
create or replace function public.guest_view(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.project_shares;
  p public.projects;
  result jsonb;
begin
  s := public.active_share(p_token);
  if s.id is null then
    return null;
  end if;
  select * into p from public.projects where id = s.project_id;
  if p.id is null then
    return null;
  end if;

  update public.project_shares set view_count = view_count + 1, last_viewed_at = now() where id = s.id;

  result := jsonb_build_object(
    'share', jsonb_build_object('label', s.label, 'expiresAt', s.expires_at,
      'showProgress', s.show_progress, 'showModel', s.show_model, 'showPhotos', s.show_photos, 'showBlueprints', s.show_blueprints),
    'project', jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name, 'city', p.city, 'country', p.country,
      'type', p.type, 'builtAreaM2', p.built_area_m2, 'levels', p.levels, 'structuralSystem', p.structural_system,
      'status', p.status, 'startDate', p.start_date, 'plannedEndDate', p.planned_end_date, 'description', p.description)
  );

  if s.show_progress then
    result := result || jsonb_build_object('stages', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'icon', st.icon, 'order', st.sort_order, 'weight', st.weight,
        'total', (select count(*) from public.tasks t where t.stage_id = st.id),
        'done', (select count(*) from public.tasks t where t.stage_id = st.id and t.status = 'done'),
        'inProgress', (select count(*) from public.tasks t where t.stage_id = st.id and t.status = 'in_progress')) order by st.sort_order)
      from public.stages st where st.project_id = p.id), '[]'::jsonb));
  end if;

  if s.show_model and p.model_path is not null then
    result := result || jsonb_build_object('model', jsonb_build_object('path', p.model_path, 'settings', p.model_settings));
  end if;

  if s.show_photos then
    result := result || jsonb_build_object('photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.file_path, 'thumb', ph.thumb_path, 'caption', ph.caption,
        'takenAt', ph.taken_at, 'width', ph.width, 'height', ph.height, 'stageId', ph.stage_id) order by ph.taken_at desc, ph.created_at desc)
      from public.site_photos ph where ph.project_id = p.id), '[]'::jsonb));
  end if;

  if s.show_blueprints then
    result := result || jsonb_build_object('blueprints', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'title', b.title, 'category', b.category, 'level', b.level,
        'revision', b.revision, 'path', b.file_path, 'mime', b.mime, 'fileName', b.file_name, 'uploadedAt', b.uploaded_at) order by b.sort_order, b.code)
      from public.blueprints b where b.project_id = p.id and b.file_path is not null), '[]'::jsonb));
  end if;

  return result;
end;
$$;
revoke all on function public.guest_view(text) from public;
grant execute on function public.guest_view(text) to anon, authenticated;

-- ── 4. Storage ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('project-blueprints', 'project-blueprints', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('project-photos', 'project-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "project_docs_read" on storage.objects for select to authenticated
  using (bucket_id in ('project-blueprints', 'project-photos') and public.has_permission('project.view'));
create policy "project_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('project-blueprints', 'project-photos') and public.has_permission('documents.manage'));
create policy "project_docs_update" on storage.objects for update to authenticated
  using (bucket_id in ('project-blueprints', 'project-photos') and public.has_permission('documents.manage'))
  with check (bucket_id in ('project-blueprints', 'project-photos') and public.has_permission('documents.manage'));
create policy "project_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('project-blueprints', 'project-photos') and public.has_permission('documents.manage'));

-- Invitados: lectura con token válido (planos, fotos y modelo según el enlace)
create policy "guest_files_read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('project-blueprints', 'project-photos', 'project-models') and public.guest_can_read(bucket_id, name));
