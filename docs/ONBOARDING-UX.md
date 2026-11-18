# Análisis UX · "Completa tu proyecto"

Objetivo: que un proyecto real quede cargado de principio a fin sin que el usuario tenga que
adivinar qué falta. El dashboard solo es útil si cada módulo tiene datos; por eso el asistente
sigue el orden en que cada dato **depende** del anterior.

| # | Paso | Qué se llena | Por qué en este orden | Completo cuando |
|---|---|---|---|---|
| 1 | Información general | Nombre, código, cliente, tipo, alcance, ciudad/país, área, niveles, sistema estructural, fechas, estado | Todo lo demás cuelga del proyecto; las fechas definen la curva de inversión | Nombre, tipo, ciudad y fechas |
| 2 | Equipo | Integrantes y cargo | Las actividades necesitan responsable | ≥ 1 integrante |
| 3 | Etapas | Fases con tipo y peso (plantilla sugerida 8/12/62/18 %) | El avance físico pondera por etapa | ≥ 1 etapa y pesos = 100 % |
| 4 | Actividades | Por etapa: actividad, responsable, fecha, prioridad (con sugerencias) | El avance se calcula con actividades completadas | Cada etapa con ≥ 1 actividad |
| 5 | Presupuesto y finanzas | Presupuesto aprobado; gastos (fecha, concepto, categoría, valor) | Ejecución y desviación = gastos vs. presupuesto/plan | Presupuesto > 0 |
| 6 | Materiales e inventario *(opcional)* | Material, unidad, cantidad prevista, precio, stock mínimo, proveedor, existencia inicial; entradas/salidas | Alertas de stock y valor previsto | ≥ 1 material o “No aplica” |
| 7 | Cotizaciones *(opcional)* | Cotizaciones con ítems, AIU e IVA | Propuestas económicas del proyecto | ≥ 1 cotización o “No aplica” |

Principios aplicados
- **Progreso derivado de datos reales**, no de casillas: la barra nunca miente.
- **Un paso, una decisión**; los pasos opcionales se pueden marcar “No aplica”.
- **Plantillas y sugerencias** (etapas, actividades) para no empezar en blanco.
- **Estados vacíos accionables** en cada módulo del dashboard que llevan al paso correspondiente.
- **Guardado inmediato en Supabase** por elemento; los permisos los aplica la base de datos (RLS).

Pendiente para próximas iteraciones: carga de planos (PDF/imagen en Supabase Storage),
modelo 3D propio (GLB/IFC), curva de inversión por etapas, aprobación de cotizaciones por rol.
