-- Privilegios explícitos (el proyecto no expone tablas por defecto). RLS sigue filtrando cada fila.
grant usage on schema public to anon, authenticated;

grant select on
  public.projects, public.members, public.stages, public.tasks, public.task_notes,
  public.materials, public.inventory_movements, public.quotes, public.quote_items,
  public.expenses, public.planned_curve, public.blueprints
to anon, authenticated;

-- Escritura solo para sesiones autenticadas; las políticas exigen además public.is_editor()
grant insert, update, delete on
  public.stages, public.tasks, public.task_notes, public.quotes, public.quote_items
to authenticated;

grant select on public.editors to authenticated;
