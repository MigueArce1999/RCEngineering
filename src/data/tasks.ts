/**
 * Generador determinista de actividades de demostración (100 por etapa).
 * Los títulos se construyen con capítulos reales de obra y los identificadores
 * de elementos del modelo 3D (src/lib/house/spec.ts) para mantener la trazabilidad.
 * DATOS FICTICIOS.
 */
import type { Priority, Task } from "@/types";
import { addDays } from "@/lib/format";
import { DEMO_BASE_DATE } from "./demo";
import { AXIS_X, AXIS_Z, GRID_X } from "@/lib/house/spec";

interface Seed {
  title: string;
  description: string;
  category: string;
  assigneeId: string;
  priority?: Priority;
  elementIds?: string[];
}

const SPACES_N1 = ["Hall de acceso", "Sala", "Comedor", "Cocina", "Estudio", "Baño social", "Zona de servicios", "Garaje", "Escalera"];
const SPACES_N2 = ["Habitación principal", "Vestier", "Baño principal", "Habitación 2", "Habitación 3", "Baño 2", "Sala de estar", "Balcón", "Terraza"];
const SPACES = [...SPACES_N1, ...SPACES_N2];
const COLUMNS_N1 = GRID_X.flatMap((_, i) => AXIS_Z.map((z) => `${z}${AXIS_X[i]}`));
const CHAPTERS = [
  "Preliminares",
  "Cimentación",
  "Estructura",
  "Mampostería",
  "Pañetes",
  "Instalaciones hidrosanitarias",
  "Instalaciones eléctricas",
  "Cubierta",
  "Pisos y enchapes",
  "Carpintería metálica",
  "Carpintería en madera",
  "Pintura",
  "Aparatos sanitarios",
  "Obras exteriores",
];

// ── Etapa 1 · Estudios y levantamiento ─────────────────────────────────
function stage1(): Seed[] {
  const s: Seed[] = [
    { title: "Realizar visita técnica inicial al predio", description: "Recorrido con el cliente, verificación de accesos, vecindades y condiciones del lote.", category: "Visita técnica", assigneeId: "usr-01", priority: "high" },
    { title: "Asignar trabajos de la Etapa 1", description: "Distribuir actividades de levantamiento entre topografía, arquitectura y estructuras.", category: "Coordinación", assigneeId: "usr-01", priority: "high" },
    { title: "Levantamiento topográfico planialtimétrico", description: "Curvas de nivel cada 0.25 m, linderos y cotas de vía.", category: "Topografía", assigneeId: "usr-04", priority: "high" },
    { title: "Consulta de norma urbanística (POT Barranquilla)", description: "Índices de ocupación y construcción, aislamientos y alturas permitidas.", category: "Normativa", assigneeId: "usr-02", priority: "medium" },
    { title: "Certificado de tradición y libertad", description: "Verificar titularidad, área y gravámenes del predio.", category: "Normativa", assigneeId: "usr-01", priority: "medium" },
    { title: "Informe de hallazgos del levantamiento", description: "Documento consolidado con restricciones y recomendaciones para diseño.", category: "Informe", assigneeId: "usr-01", priority: "high" },
  ];
  ["S1", "S2", "S3", "S4"].forEach((p) =>
    s.push({ title: `Estudio de suelos · sondeo ${p}`, description: `Perforación a 8 m, toma de muestras y registro estratigráfico del sondeo ${p}.`, category: "Geotecnia", assigneeId: "usr-03", priority: "high" }),
  );
  ["norte", "sur", "oriente", "occidente"].forEach((l) =>
    s.push({ title: `Verificación de lindero ${l}`, description: `Contrastar mojones y medidas del lindero ${l} con la escritura.`, category: "Topografía", assigneeId: "usr-04" }),
  );
  ["acueducto", "alcantarillado", "energía", "gas natural", "telecomunicaciones"].forEach((r) =>
    s.push({ title: `Inventario de redes existentes · ${r}`, description: `Ubicar acometida y punto de conexión de ${r}; registrar diámetros y profundidades.`, category: "Redes", assigneeId: "usr-04" }),
  );
  ["fachada del lote", "vía pública", "lindero norte", "lindero sur", "lindero oriente", "lindero occidente", "vegetación existente"].forEach((r) =>
    s.push({ title: `Registro fotográfico · ${r}`, description: `Fotografías georreferenciadas de ${r} para el expediente del proyecto.`, category: "Registro fotográfico", assigneeId: "usr-02", priority: "low" }),
  );
  SPACES.forEach((sp) =>
    s.push({ title: `Levantamiento arquitectónico · ${sp}`, description: `Medición de áreas, alturas y vanos propuestos para ${sp.toLowerCase()} según programa del cliente.`, category: "Levantamiento", assigneeId: "usr-02" }),
  );
  SPACES.forEach((sp) =>
    s.push({ title: `Verificación de medidas · ${sp}`, description: `Contrastar dimensiones de ${sp.toLowerCase()} con el anteproyecto y registrar diferencias.`, category: "Verificación", assigneeId: "usr-04", priority: "low" }),
  );
  COLUMNS_N1.forEach((c) =>
    s.push({ title: `Identificación de elemento estructural · eje ${c}`, description: `Replantear la posición de la columna ${c} y validar compatibilidad con linderos y redes.`, category: "Estructura", assigneeId: "usr-03", elementIds: [`COL-N1-${c}`, `ZAP-${c}`] }),
  );
  CHAPTERS.forEach((c) =>
    s.push({ title: `Validación de cantidades preliminares · ${c}`, description: `Primer estimado de cantidades del capítulo ${c} para el presupuesto base.`, category: "Cantidades", assigneeId: "usr-05" }),
  );
  ["P1", "P2", "P3", "P4", "P5", "P6"].forEach((p) =>
    s.push({ title: `Nivelación de punto de control ${p}`, description: `Amarrar el punto ${p} a la cota de referencia de la vía.`, category: "Topografía", assigneeId: "usr-04", priority: "low" }),
  );
  ["energía", "acueducto", "alcantarillado", "gas"].forEach((r) =>
    s.push({ title: `Solicitud de disponibilidad de servicio · ${r}`, description: `Radicar ante el operador la solicitud de disponibilidad de ${r}.`, category: "Trámites", assigneeId: "usr-01", priority: "medium" }),
  );
  s.push({ title: "Reunión de cierre de Etapa 1", description: "Presentación de hallazgos al cliente y aprobación para iniciar diseño.", category: "Coordinación", assigneeId: "usr-01", priority: "high" });
  return s;
}

// ── Etapa 2 · Diseño y planificación ───────────────────────────────────
function stage2(): Seed[] {
  const s: Seed[] = [];
  [
    "Planta arquitectónica N1",
    "Planta arquitectónica N2",
    "Planta de cubiertas",
    "Fachada principal",
    "Fachada posterior",
    "Fachadas laterales",
    "Corte longitudinal",
    "Corte transversal",
    "Planta de cimentación",
    "Cuadro de columnas",
    "Planta de entrepiso",
    "Planta estructural de cubierta",
    "Despiece de vigas",
    "Instalaciones eléctricas N1",
    "Instalaciones eléctricas N2",
    "Hidrosanitario N1",
    "Hidrosanitario N2",
    "Red de gas",
    "Detalle de escalera",
    "Detalle de piscina",
    "Detalle de baños",
    "Detalle de cocina",
    "Detalle de carpintería",
    "Detalle de celosía",
  ].forEach((p) =>
    s.push({ title: `Elaboración de planos · ${p}`, description: `Dibujo, acotado y rotulado del plano "${p}".`, category: "Planos", assigneeId: p.includes("Hidro") || p.includes("eléctr") || p.includes("gas") ? "usr-03" : p.match(/cimentación|columnas|entrepiso|vigas|estructural/i) ? "usr-03" : "usr-02", priority: "medium" }),
  );
  CHAPTERS.forEach((c) =>
    s.push({ title: `Validación de cantidades de obra · ${c}`, description: `Cuantificar el capítulo ${c} a partir de los planos aprobados.`, category: "Cantidades", assigneeId: "usr-05" }),
  );
  CHAPTERS.forEach((c) =>
    s.push({ title: `Análisis de precio unitario · ${c}`, description: `Construir APU del capítulo ${c}: materiales, mano de obra, equipo y transporte.`, category: "APU", assigneeId: "usr-05" }),
  );
  CHAPTERS.forEach((c) =>
    s.push({ title: `Revisión de presupuesto · ${c}`, description: `Revisar consistencia de cantidades y APU del capítulo ${c}.`, category: "Presupuesto", assigneeId: "usr-01", priority: "medium" }),
  );
  [
    "Memoria de cálculo estructural NSR-10",
    "Estudio de cargas y combinaciones",
    "Modelo de análisis estructural",
    "Cálculo de cimentación",
    "Diseño de losa aligerada",
    "Diseño de vigas de entrepiso",
    "Diseño de columnas",
    "Revisión de derivas",
  ].forEach((t) => s.push({ title: t, description: "Entregable de diseño estructural para radicación.", category: "Diseño estructural", assigneeId: "usr-03", priority: "high" }));
  [
    "Programación de obra (diagrama de Gantt)",
    "Flujo de caja del proyecto",
    "Plan de compras de materiales",
    "Plan de manejo ambiental de obra",
    "Plan de seguridad y salud en el trabajo",
    "Radicación de licencia de construcción",
    "Respuesta a acta de observaciones de curaduría",
    "Contratación de mano de obra",
    "Selección de proveedores de concreto",
    "Selección de proveedores de acero",
    "Aprobación de diseño por el cliente",
    "Modelo 3D de coordinación",
    "Renders de aprobación",
    "Paleta de materiales y acabados",
    "Especificaciones técnicas de construcción",
    "Cronograma de pagos al contratista",
    "Póliza de responsabilidad civil",
    "Acta de inicio de obra",
    "Revisión de interferencias entre redes",
    "Tabla de acabados por espacio",
    "Cuadro de áreas para licencia",
    "Cálculo de iluminación interior",
    "Cuadro de cargas eléctricas",
    "Diseño hidráulico de piscina",
    "Diseño paisajístico",
    "Reunión de cierre de Etapa 2",
  ].forEach((t) => s.push({ title: t, description: "Actividad de planificación previa al inicio de obra.", category: "Planificación", assigneeId: "usr-01" }));
  return s;
}

// ── Etapa 3 · Ejecución de obra ────────────────────────────────────────
function stage3(): Seed[] {
  const s: Seed[] = [
    { title: "Localización y replanteo", description: "Trazado de ejes con estación total.", category: "Preliminares", assigneeId: "usr-04", priority: "high" },
    { title: "Descapote y limpieza del lote", description: "Retiro de capa vegetal e = 0.20 m.", category: "Preliminares", assigneeId: "usr-06" },
    { title: "Excavación mecánica general", description: "Excavación a nivel de cimentación.", category: "Cimentación", assigneeId: "usr-06" },
  ];
  COLUMNS_N1.forEach((c) =>
    s.push({ title: `Excavación y vaciado · zapata ${c}`, description: `Excavación manual, solado, armado y vaciado de la zapata ${c}.`, category: "Cimentación", assigneeId: "usr-06", priority: "high", elementIds: [`ZAP-${c}`] }),
  );
  COLUMNS_N1.forEach((c) =>
    s.push({ title: `Armado y vaciado · columna ${c} N1`, description: `Armado de acero, formaleta y vaciado de la columna ${c} del nivel 1.`, category: "Estructura", assigneeId: "usr-06", priority: "high", elementIds: [`COL-N1-${c}`] }),
  );
  COLUMNS_N1.filter((c) => !c.endsWith("1")).forEach((c) =>
    s.push({ title: `Armado y vaciado · columna ${c} N2`, description: `Armado de acero, formaleta y vaciado de la columna ${c} del nivel 2.`, category: "Estructura", assigneeId: "usr-06", elementIds: [`COL-N2-${c}`] }),
  );
  [...AXIS_Z, ...AXIS_X].forEach((a) =>
    s.push({ title: `Vigas de entrepiso · eje ${a}`, description: `Formaleta, acero y vaciado de la viga del eje ${a} (entrepiso).`, category: "Estructura", assigneeId: "usr-06", elementIds: [`VIG-N2-${a}`] }),
  );
  [...AXIS_Z, ...AXIS_X.slice(1)].forEach((a) =>
    s.push({ title: `Vigas de cubierta · eje ${a}`, description: `Formaleta, acero y vaciado de la viga del eje ${a} (cubierta).`, category: "Estructura", assigneeId: "usr-06", elementIds: [`VIG-N3-${a}`] }),
  );
  s.push(
    { title: "Placa de contrapiso N1", description: "Relleno compactado, malla electrosoldada y vaciado de placa.", category: "Estructura", assigneeId: "usr-06", priority: "high", elementIds: ["LOS-N1"] },
    { title: "Losa aligerada de entrepiso", description: "Casetón, viguetas, acero y vaciado de losa N2.", category: "Estructura", assigneeId: "usr-06", priority: "critical", elementIds: ["LOS-N2"] },
    { title: "Balcón en voladizo", description: "Armado y vaciado del balcón del nivel 2.", category: "Estructura", assigneeId: "usr-06", elementIds: ["BAL-201"] },
    { title: "Losa de cubierta", description: "Vaciado de losa de cubierta con pendientes.", category: "Estructura", assigneeId: "usr-06", priority: "critical", elementIds: ["LOS-CUB"] },
    { title: "Impermeabilización y cubierta verde", description: "Manto, capa drenante, sustrato y sedum.", category: "Cubierta", assigneeId: "usr-06", elementIds: ["CUB-VERDE"] },
    { title: "Marco volado de fachada N2", description: "Estructura liviana y panel de fibrocemento.", category: "Fachada", assigneeId: "usr-06", elementIds: ["MAR-201"] },
  );
  ["MUR-101", "MUR-102", "MUR-103", "MUR-104", "MUR-105", "MUR-201", "MUR-203", "MUR-202", "MUR-204"].forEach((m) =>
    s.push({ title: `Mampostería · ${m}`, description: `Levante de muro ${m} en bloque #5 con mortero 1:4.`, category: "Mampostería", assigneeId: "usr-06", elementIds: [m] }),
  );
  ["N1", "N2"].forEach((n) => {
    s.push({ title: `Regatas y tubería eléctrica · ${n}`, description: `Instalación de tubería conduit en muros y losas del ${n}.`, category: "Instalaciones eléctricas", assigneeId: "usr-06" });
    s.push({ title: `Red hidráulica · ${n}`, description: `Tubería PVC presión y pruebas hidrostáticas ${n}.`, category: "Instalaciones hidrosanitarias", assigneeId: "usr-06" });
    s.push({ title: `Red sanitaria · ${n}`, description: `Tubería sanitaria y ventilación ${n}.`, category: "Instalaciones hidrosanitarias", assigneeId: "usr-06" });
    s.push({ title: `Pañete de muros · ${n}`, description: `Pañete liso 1:4 en muros interiores y exteriores del ${n}.`, category: "Pañetes", assigneeId: "usr-06" });
  });
  [
    "Ensayo de cilindros a 7 días",
    "Ensayo de cilindros a 28 días",
    "Excavación de piscina",
    "Estructura de piscina",
    "Cerramiento perimetral",
    "Red de gas natural",
    "Acometida eléctrica",
    "Acometida de acueducto",
    "Cajas de inspección sanitaria",
    "Prueba de estanqueidad de cubierta",
    "Interventoría de estructura",
    "Bitácora semanal de obra",
    "Escalera en concreto reforzado",
    "Dinteles y alfajías",
    "Columnetas de confinamiento",
    "Vigas de amarre de mampostería",
    "Juntas de dilatación",
    "Inspección de andamios certificados",
  ].forEach((t) => s.push({ title: t, description: "Actividad de ejecución y control de calidad.", category: "Control de obra", assigneeId: "usr-06" }));
  return s;
}

// ── Etapa 4 · Acabados y entrega ───────────────────────────────────────
function stage4(): Seed[] {
  const s: Seed[] = [];
  SPACES.forEach((sp) => s.push({ title: `Pisos y enchapes · ${sp}`, description: `Instalación de piso y enchape en ${sp.toLowerCase()}.`, category: "Pisos y enchapes", assigneeId: "usr-06" }));
  SPACES.forEach((sp) => s.push({ title: `Estuco y pintura · ${sp}`, description: `Estuco, lijado y dos manos de vinilo tipo 1 en ${sp.toLowerCase()}.`, category: "Pintura", assigneeId: "usr-06" }));
  SPACES.filter((sp) => sp !== "Balcón").forEach((sp) => s.push({ title: `Instalación de guardaescobas · ${sp}`, description: `Guardaescobas en ${sp.toLowerCase()} acorde con el piso instalado.`, category: "Pisos y enchapes", assigneeId: "usr-06", priority: "low" }));
  ["VEN-101", "VEN-102", "VEN-103", "VEN-104", "VEN-105", "VEN-106", "VEN-107", "VEN-108", "VEN-201", "VEN-202", "VEN-203", "VEN-204", "VEN-205", "VEN-206"].forEach((v) =>
    s.push({ title: `Instalación de ventanería · ${v}`, description: `Montaje de marco, vidrio templado y sellos de ${v}.`, category: "Carpintería metálica", assigneeId: "usr-06", elementIds: [v] }),
  );
  ["PUE-101", "PUE-102", "PUE-201"].forEach((p) => s.push({ title: `Instalación de puerta · ${p}`, description: `Montaje, nivelación y herrajes de ${p}.`, category: "Carpintería", assigneeId: "usr-06", elementIds: [p] }));
  [
    ["Barandas de vidrio · balcón", "BAR-201"],
    ["Barandas de vidrio · terraza", "BAR-202"],
    ["Celosía vertical de fachada", "CEL-001"],
    ["Alero en madera del voladizo", "ALE-201"],
    ["Deck de terraza N2", "TER-N2"],
  ].forEach(([t, id]) => s.push({ title: t, description: "Instalación de elemento de fachada.", category: "Fachada", assigneeId: "usr-06", elementIds: [id] }));
  [
    "Pintura de fachadas",
    "Mesones de cocina en cuarzo",
    "Muebles de cocina",
    "Closets y vestier",
    "Aparatos sanitarios · baño social",
    "Aparatos sanitarios · baño principal",
    "Aparatos sanitarios · baño 2",
    "Grifería general",
    "Luminarias interiores",
    "Luminarias exteriores y paisajismo",
    "Tablero eléctrico y marcación de circuitos",
    "Enchape de piscina",
    "Equipos de piscina",
    "Paisajismo y grama",
    "Senderos en concreto lavado",
    "Pruebas de instalaciones eléctricas (RETIE)",
    "Pruebas hidráulicas finales",
    "Limpieza final de obra",
    "Inventario de entrega",
    "Recorrido de entrega con el cliente",
    "Atención de observaciones de entrega",
    "Manual de uso y mantenimiento",
    "Planos récord",
    "Liquidación del contrato",
    "Acta de entrega final",
  ].forEach((t) => s.push({ title: t, description: "Actividad de acabados y cierre del proyecto.", category: "Acabados", assigneeId: "usr-06" }));
  return s;
}

const PRIORITY_CYCLE: Priority[] = ["medium", "low", "medium", "high"];

function build(stageId: string, seeds: Seed[], startOffset: number, spanDays: number, inProgress: number[]): Task[] {
  if (seeds.length < 100) throw new Error(`La etapa ${stageId} tiene ${seeds.length} actividades semilla (< 100)`);
  return seeds.slice(0, 100).map((seed, i) => ({
    id: `${stageId.replace("stg", "tsk")}-${String(i + 1).padStart(3, "0")}`,
    stageId,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    assigneeId: seed.assigneeId,
    priority: seed.priority ?? PRIORITY_CYCLE[i % PRIORITY_CYCLE.length],
    status: inProgress.includes(i) ? "in_progress" : "pending",
    dueDate: addDays(DEMO_BASE_DATE, startOffset + Math.floor((i / 100) * spanDays)),
    notes: [],
    elementIds: seed.elementIds ?? [],
  }));
}

export function buildDemoTasks(): Task[] {
  return [
    // Etapa 1 en proceso: actividades con avance parcial pero ninguna terminada (0 de 100)
    ...build("stg-01", stage1(), 0, 38, [0, 1, 2, 3, 6]),
    ...build("stg-02", stage2(), 40, 110, []),
    ...build("stg-03", stage3(), 155, 330, []),
    ...build("stg-04", stage4(), 470, 120, []),
  ];
}
