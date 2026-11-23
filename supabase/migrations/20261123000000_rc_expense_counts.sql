-- Gastos que se registran pero no salen del presupuesto del proyecto
-- (p. ej. una nómina enviada al contratista que paga otra parte). Siguen visibles, pero no se descuentan.
alter table public.expenses add column counts boolean not null default true;
