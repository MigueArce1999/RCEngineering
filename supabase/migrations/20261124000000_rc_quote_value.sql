-- Valor cotizado (contrato) del proyecto o etapa, separado del presupuesto que aprueban los propietarios.
--   quoted_value  = lo que se cotizó (p. ej. Etapa 1 completa)
--   approved_budget = fondos asignados hasta ahora por los propietarios (puede ser menor que la cotización)
alter table public.projects
  add column quoted_value bigint not null default 0 check (quoted_value >= 0),
  add column quote_label text not null default 'Cotización' check (length(quote_label) <= 80);
