-- Modelo 3D propio por proyecto (archivo HTML autocontenido; GLB/IFC en el futuro)
-- Se guarda en un bucket PRIVADO: solo lo leen usuarios con project.view y lo cargan quienes tienen projects.manage.

alter table public.projects
  add column model_path text,
  add column model_settings jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-models', 'project-models', false, 52428800, array['text/html', 'model/gltf-binary', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "project_models_read" on storage.objects for select to authenticated
  using (bucket_id = 'project-models' and public.has_permission('project.view'));
create policy "project_models_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-models' and public.has_permission('projects.manage'));
create policy "project_models_update" on storage.objects for update to authenticated
  using (bucket_id = 'project-models' and public.has_permission('projects.manage'))
  with check (bucket_id = 'project-models' and public.has_permission('projects.manage'));
create policy "project_models_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-models' and public.has_permission('projects.manage'));
