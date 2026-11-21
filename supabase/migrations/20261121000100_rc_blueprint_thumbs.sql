-- Miniatura de cada plano (imagen o primera página del PDF), para listas y la vista de invitado
alter table public.blueprints add column thumb_path text;

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
        'revision', b.revision, 'path', b.file_path, 'thumb', b.thumb_path, 'mime', b.mime, 'fileName', b.file_name, 'uploadedAt', b.uploaded_at) order by b.sort_order, b.code)
      from public.blueprints b where b.project_id = p.id and b.file_path is not null), '[]'::jsonb));
  end if;

  return result;
end;
$$;
