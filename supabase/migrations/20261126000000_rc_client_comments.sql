-- Comentarios de clientes (invitados) sobre el proyecto, con aviso al administrador.
--  · El invitado comenta con su enlace (RPC guest_add_comment) y ve el estado de lo que pidió (guest_comments).
--  · El equipo (projects.manage) los lee y gestiona; Realtime avisa al instante.

alter table public.project_shares add column allow_comments boolean not null default true;
grant update (allow_comments) on public.project_shares to authenticated;

create table public.client_comments (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects (id) on delete cascade,
  share_id text references public.project_shares (id) on delete set null,
  author text not null check (length(author) between 1 and 80),
  body text not null check (length(body) between 1 and 1500),
  ref_type text not null default 'general' check (ref_type in ('general', 'modelo', 'foto', 'plano', 'avance')),
  ref_id text,
  ref_label text not null default '' check (length(ref_label) <= 160),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'dismissed')),
  -- Respuesta del equipo: la ve el cliente
  reply text not null default '' check (length(reply) <= 1000),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  resolved_at timestamptz
);
create index client_comments_project_idx on public.client_comments (project_id, created_at desc);
alter table public.client_comments enable row level security;
create policy "client_comments_read" on public.client_comments for select to authenticated using (public.has_permission('projects.manage'));
create policy "client_comments_update" on public.client_comments for update to authenticated using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));
create policy "client_comments_delete" on public.client_comments for delete to authenticated using (public.has_permission('projects.manage'));
grant select, delete on public.client_comments to authenticated;
grant update (status, reply, seen_at, resolved_at) on public.client_comments to authenticated;

-- Realtime: el administrador recibe el comentario al instante
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.client_comments;
  end if;
exception when duplicate_object then null;
end $$;

-- Invitado: enviar un comentario (máx. 20 por hora y enlace; el texto va limpio de espacios)
create or replace function public.guest_add_comment(p_token text, p_author text, p_body text, p_ref_type text, p_ref_id text, p_ref_label text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.project_shares;
  c public.client_comments;
  body text := btrim(coalesce(p_body, ''));
  author text := btrim(coalesce(p_author, ''));
begin
  s := public.active_share(p_token);
  if s.id is null then
    raise exception 'El enlace no está disponible';
  end if;
  if not s.allow_comments then
    raise exception 'Los comentarios están desactivados en este enlace';
  end if;
  if length(body) = 0 or length(body) > 1500 then
    raise exception 'El comentario debe tener entre 1 y 1500 caracteres';
  end if;
  if length(author) = 0 then
    author := coalesce(nullif(btrim(s.label), ''), 'Invitado');
  end if;
  if (select count(*) from public.client_comments where share_id = s.id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Has enviado muchos comentarios seguidos. Inténtalo más tarde.';
  end if;
  insert into public.client_comments (project_id, share_id, author, body, ref_type, ref_id, ref_label)
  values (s.project_id, s.id, left(author, 80), body,
          case when p_ref_type in ('general', 'modelo', 'foto', 'plano', 'avance') then p_ref_type else 'general' end,
          left(p_ref_id, 80), left(coalesce(p_ref_label, ''), 160))
  returning * into c;
  return jsonb_build_object('id', c.id, 'createdAt', c.created_at);
end;
$$;
revoke all on function public.guest_add_comment(text, text, text, text, text, text) from public;
grant execute on function public.guest_add_comment(text, text, text, text, text, text) to anon, authenticated;

-- Invitado: ver sus comentarios, su estado y la respuesta del equipo
create or replace function public.guest_comments(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare s public.project_shares;
begin
  s := public.active_share(p_token);
  if s.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'allow', s.allow_comments,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'author', c.author, 'body', c.body, 'refType', c.ref_type, 'refLabel', c.ref_label,
        'status', c.status, 'reply', c.reply, 'createdAt', c.created_at) order by c.created_at desc)
      from public.client_comments c where c.share_id = s.id), '[]'::jsonb));
end;
$$;
revoke all on function public.guest_comments(text) from public;
grant execute on function public.guest_comments(text) to anon, authenticated;
