-- Comentarios anclados a un punto del modelo 3D (como en Figma):
-- pin = { p: [x,y,z] punto del modelo, cam: [x,y,z] posición de la cámara, tgt: [x,y,z] hacia dónde miraba, fov }
alter table public.client_comments add column pin jsonb;

drop function if exists public.guest_add_comment(text, text, text, text, text, text);
create or replace function public.guest_add_comment(p_token text, p_author text, p_body text, p_ref_type text, p_ref_id text, p_ref_label text, p_pin jsonb default null)
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
  clean jsonb := null;
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
  -- Solo se guardan las claves esperadas, con números (nada de contenido arbitrario)
  if p_pin is not null and jsonb_typeof(p_pin) = 'object' and jsonb_typeof(p_pin -> 'p') = 'array' and jsonb_array_length(p_pin -> 'p') = 3
     and jsonb_typeof(p_pin -> 'cam') = 'array' and jsonb_array_length(p_pin -> 'cam') = 3
     and jsonb_typeof(p_pin -> 'tgt') = 'array' and jsonb_array_length(p_pin -> 'tgt') = 3 and pg_column_size(p_pin) < 800 then
    clean := jsonb_build_object('p', p_pin -> 'p', 'cam', p_pin -> 'cam', 'tgt', p_pin -> 'tgt', 'fov', coalesce((p_pin ->> 'fov')::numeric, 45));
  end if;
  insert into public.client_comments (project_id, share_id, author, body, ref_type, ref_id, ref_label, pin)
  values (s.project_id, s.id, left(author, 80), body,
          case when p_ref_type in ('general', 'modelo', 'foto', 'plano', 'avance') then p_ref_type else 'general' end,
          left(p_ref_id, 80), left(coalesce(p_ref_label, ''), 160), clean)
  returning * into c;
  return jsonb_build_object('id', c.id, 'createdAt', c.created_at);
end;
$$;
revoke all on function public.guest_add_comment(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.guest_add_comment(text, text, text, text, text, text, jsonb) to anon, authenticated;

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
        'status', c.status, 'reply', c.reply, 'createdAt', c.created_at, 'pin', c.pin) order by c.created_at desc)
      from public.client_comments c where c.share_id = s.id), '[]'::jsonb));
end;
$$;
