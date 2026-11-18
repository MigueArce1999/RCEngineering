/**
 * DATOS DE DEMOSTRACIÓN — FICTICIOS.
 * Personas, proyectos, cifras y documentos de este archivo no corresponden a información real.
 * Sustituir por la capa de datos (src/lib/api.ts) cuando exista backend.
 */
import type {
  Blueprint,
  ConstructionStage,
  Expense,
  InventoryMovement,
  Material,
  Project,
  ProjectMember,
  Quote,
} from "@/types";

export const DEMO_NOTICE = "Datos de demostración ficticios";

/** Fecha de corte de los datos de demostración. */
export const DEMO_BASE_DATE = "2026-11-18";

export const projects: Project[] = [
  {
    id: "prj-rc-001",
    code: "RC-001",
    name: "Residencia RC-001",
    city: "Barranquilla",
    country: "Colombia",
    type: "Vivienda residencial",
    builtAreaM2: 420,
    levels: 2,
    structuralSystem: "Concreto reforzado",
    status: "active",
    startDate: "2026-10-01",
    plannedEndDate: "2028-03-31",
    hasDemoData: true,
  },
  {
    id: "prj-rc-002",
    code: "RC-002",
    name: "Edificio Mirador del Río",
    city: "Barranquilla",
    country: "Colombia",
    type: "Multifamiliar",
    builtAreaM2: 3850,
    levels: 8,
    structuralSystem: "Pórticos de concreto",
    status: "paused",
    startDate: "2027-02-01",
    plannedEndDate: "2029-06-30",
    hasDemoData: false,
  },
  {
    id: "prj-rc-003",
    code: "RC-003",
    name: "Bodega logística Malambo",
    city: "Malambo",
    country: "Colombia",
    type: "Industrial",
    builtAreaM2: 2400,
    levels: 1,
    structuralSystem: "Estructura metálica",
    status: "paused",
    startDate: "2027-05-01",
    plannedEndDate: "2028-01-31",
    hasDemoData: false,
  },
];

export const members: ProjectMember[] = [
  { id: "usr-01", name: "Ing. Camila Restrepo", role: "Directora de proyecto", initials: "CR" },
  { id: "usr-02", name: "Arq. Andrés Pacheco", role: "Arquitecto diseñador", initials: "AP" },
  { id: "usr-03", name: "Ing. Laura Mendoza", role: "Ingeniera estructural", initials: "LM" },
  { id: "usr-04", name: "Téc. Jorge Díaz", role: "Topógrafo", initials: "JD" },
  { id: "usr-05", name: "Ing. Valentina Ortiz", role: "Presupuestos y APU", initials: "VO" },
  { id: "usr-06", name: "M. O. Ricardo Barrios", role: "Maestro de obra", initials: "RB" },
];

export const CURRENT_USER_ID = "usr-01";

export const stages: ConstructionStage[] = [
  { id: "stg-01", projectId: "prj-rc-001", order: 1, name: "Estudios y levantamiento", icon: "survey", weight: 0.08 },
  { id: "stg-02", projectId: "prj-rc-001", order: 2, name: "Diseño y planificación", icon: "design", weight: 0.12 },
  { id: "stg-03", projectId: "prj-rc-001", order: 3, name: "Ejecución de obra", icon: "build", weight: 0.62 },
  { id: "stg-04", projectId: "prj-rc-001", order: 4, name: "Acabados y entrega", icon: "finish", weight: 0.18 },
];

export const materials: Material[] = [
  { id: "mat-cem", name: "Cemento gris", spec: "Uso general · bulto 50 kg", unit: "bulto 50 kg", plannedQty: 2150, receivedQty: 380, consumedQty: 0, unitPrice: 33_900, minStock: 450, supplier: "Distribuidora Caribe (ficticio)" },
  { id: "mat-ace", name: "Acero de refuerzo", spec: "Corrugado G60 · Ø 3/8\"–5/8\"", unit: "kg", plannedQty: 26_400, receivedQty: 11_200, consumedQty: 0, unitPrice: 4_650, minStock: 4_000, supplier: "Aceros del Norte (ficticio)" },
  { id: "mat-are", name: "Arena de río", spec: "Lavada para concreto", unit: "m³", plannedQty: 148, receivedQty: 24, consumedQty: 0, unitPrice: 78_000, minStock: 20, supplier: "Agregados Atlántico (ficticio)" },
  { id: "mat-con", name: "Concreto premezclado", spec: "4000 psi · bombeable", unit: "m³", plannedQty: 186, receivedQty: 0, consumedQty: 0, unitPrice: 545_000, minStock: 0, supplier: "Concretos de la Costa (ficticio)" },
  { id: "mat-blo", name: "Bloque de arcilla", spec: "#5 · 12 × 20 × 30 cm", unit: "und", plannedQty: 9_800, receivedQty: 3_000, consumedQty: 0, unitPrice: 1_850, minStock: 1_500, supplier: "Ladrillera San José (ficticio)" },
  { id: "mat-gra", name: "Grava triturada", spec: "3/4\" para concreto", unit: "m³", plannedQty: 96, receivedQty: 12, consumedQty: 0, unitPrice: 92_000, minStock: 15, supplier: "Agregados Atlántico (ficticio)" },
];

/** Movimientos de bodega (cantidades en la unidad propia de cada material). */
export const movements: InventoryMovement[] = [
  { id: "mov-01", materialId: "mat-ace", type: "in", qty: 6_000, date: "2026-10-06", reference: "Remisión AN-2231" },
  { id: "mov-02", materialId: "mat-blo", type: "in", qty: 1_500, date: "2026-10-09", reference: "Remisión LSJ-0412" },
  { id: "mov-03", materialId: "mat-cem", type: "in", qty: 200, date: "2026-10-14", reference: "Factura DC-7781" },
  { id: "mov-04", materialId: "mat-are", type: "in", qty: 12, date: "2026-10-20", reference: "Remisión AA-1190" },
  { id: "mov-05", materialId: "mat-ace", type: "in", qty: 5_200, date: "2026-10-27", reference: "Remisión AN-2290" },
  { id: "mov-06", materialId: "mat-gra", type: "in", qty: 12, date: "2026-10-29", reference: "Remisión AA-1214" },
  { id: "mov-07", materialId: "mat-blo", type: "in", qty: 1_500, date: "2026-11-04", reference: "Remisión LSJ-0450" },
  { id: "mov-08", materialId: "mat-cem", type: "in", qty: 180, date: "2026-11-06", reference: "Factura DC-7840" },
  { id: "mov-09", materialId: "mat-are", type: "in", qty: 12, date: "2026-11-10", reference: "Remisión AA-1251" },
];

const baseAdj = { discountPct: 0, aiu: { enabled: false, adminPct: 10, contingencyPct: 5, profitPct: 5 }, vat: { enabled: false, ratePct: 19 } };

export const quotes: Quote[] = [
  {
    id: "quo-001",
    code: "COT-2026-014",
    projectId: "prj-rc-001",
    clientName: "Familia Valle Ortega (ficticio)",
    title: "Estudios técnicos y levantamiento",
    description: "Topografía, estudio de suelos y levantamiento arquitectónico del predio.",
    status: "approved",
    createdAt: "2026-10-02",
    items: [
      { id: "qi-001", description: "Levantamiento topográfico planialtimétrico", category: "labor", unit: "gl", quantity: 1, unitPrice: 4_800_000 },
      { id: "qi-002", description: "Estudio de suelos · 4 sondeos a 8 m", category: "other", unit: "gl", quantity: 1, unitPrice: 9_600_000 },
      { id: "qi-003", description: "Levantamiento arquitectónico y registro", category: "labor", unit: "m²", quantity: 600, unitPrice: 6_500 },
      { id: "qi-004", description: "Equipo de estación total", category: "equipment", unit: "día", quantity: 4, unitPrice: 380_000 },
    ],
    adjustments: { ...baseAdj, vat: { enabled: true, ratePct: 19 } },
    notes: "Servicios profesionales gravados con IVA.",
  },
  {
    id: "quo-002",
    code: "COT-2026-015",
    projectId: "prj-rc-001",
    clientName: "Familia Valle Ortega (ficticio)",
    title: "Diseño arquitectónico y estructural",
    description: "Proyecto arquitectónico, estructural, eléctrico e hidrosanitario para licencia.",
    status: "approved",
    createdAt: "2026-10-09",
    items: [
      { id: "qi-005", description: "Diseño arquitectónico", category: "labor", unit: "m²", quantity: 420, unitPrice: 85_000 },
      { id: "qi-006", description: "Diseño estructural y memoria NSR-10", category: "labor", unit: "m²", quantity: 420, unitPrice: 42_000 },
      { id: "qi-007", description: "Diseños eléctricos e hidrosanitarios", category: "labor", unit: "m²", quantity: 420, unitPrice: 30_000 },
      { id: "qi-008", description: "Renders y modelo 3D", category: "other", unit: "gl", quantity: 1, unitPrice: 6_500_000 },
    ],
    adjustments: { ...baseAdj, discountPct: 5, vat: { enabled: true, ratePct: 19 } },
    notes: "Descuento comercial del 5 %.",
  },
  {
    id: "quo-003",
    code: "COT-2026-021",
    projectId: "prj-rc-001",
    clientName: "Familia Valle Ortega (ficticio)",
    title: "Obra gris · estructura y mampostería",
    description: "Cimentación, estructura en concreto reforzado y mampostería de los dos niveles.",
    status: "pending",
    createdAt: "2026-11-05",
    items: [
      { id: "qi-009", description: "Concreto premezclado 4000 psi", category: "materials", unit: "m³", quantity: 186, unitPrice: 545_000 },
      { id: "qi-010", description: "Acero de refuerzo G60", category: "materials", unit: "kg", quantity: 26_400, unitPrice: 4_650 },
      { id: "qi-011", description: "Mampostería bloque #5", category: "materials", unit: "m²", quantity: 980, unitPrice: 46_000 },
      { id: "qi-012", description: "Mano de obra estructura", category: "labor", unit: "m²", quantity: 420, unitPrice: 310_000 },
      { id: "qi-013", description: "Mano de obra mampostería", category: "labor", unit: "m²", quantity: 980, unitPrice: 38_000 },
      { id: "qi-014", description: "Formaleta y andamios", category: "equipment", unit: "mes", quantity: 6, unitPrice: 6_800_000 },
      { id: "qi-015", description: "Bomba de concreto", category: "equipment", unit: "día", quantity: 8, unitPrice: 1_650_000 },
      { id: "qi-016", description: "Ensayos de laboratorio y cilindros", category: "other", unit: "gl", quantity: 1, unitPrice: 5_200_000 },
    ],
    adjustments: { ...baseAdj, aiu: { enabled: true, adminPct: 10, contingencyPct: 5, profitPct: 5 }, vat: { enabled: true, ratePct: 19 } },
    notes: "Contrato bajo modalidad AIU: IVA calculado sobre la utilidad. Validar con asesoría tributaria.",
  },
];

/** Presupuesto aprobado del proyecto (COP). */
export const APPROVED_BUDGET = 1_720_000_000;

/** Curva de inversión planeada acumulada (fecha → valor acumulado esperado). */
export const plannedCurve: { date: string; amount: number }[] = [
  { date: "2026-10-01", amount: 0 },
  { date: "2026-11-30", amount: 170_000_000 },
  { date: "2026-12-31", amount: 205_000_000 },
  { date: "2027-03-31", amount: 260_000_000 },
  { date: "2027-12-31", amount: 1_330_000_000 },
  { date: "2028-03-31", amount: 1_720_000_000 },
];

export const expenses: Expense[] = [
  { id: "exp-01", date: "2026-10-06", concept: "Anticipo acero de refuerzo · 6.000 kg", category: "materials", amount: 27_900_000 },
  { id: "exp-02", date: "2026-10-09", concept: "Bloque #5 · 1.500 und", category: "materials", amount: 2_775_000 },
  { id: "exp-03", date: "2026-10-12", concept: "Estudios técnicos (COT-2026-014)", category: "labor", amount: 23_585_800 },
  { id: "exp-04", date: "2026-10-14", concept: "Cemento · 200 bultos", category: "materials", amount: 6_780_000 },
  { id: "exp-05", date: "2026-10-20", concept: "Arena de río · 12 m³", category: "materials", amount: 936_000 },
  { id: "exp-06", date: "2026-10-27", concept: "Acero de refuerzo · 5.200 kg", category: "materials", amount: 24_180_000 },
  { id: "exp-07", date: "2026-10-29", concept: "Grava triturada · 12 m³", category: "materials", amount: 1_104_000 },
  { id: "exp-08", date: "2026-11-03", concept: "Anticipo 50 % diseños (COT-2026-015)", category: "labor", amount: 40_946_710 },
  { id: "exp-09", date: "2026-11-04", concept: "Bloque #5 · 1.500 und", category: "materials", amount: 2_775_000 },
  { id: "exp-10", date: "2026-11-06", concept: "Cemento · 180 bultos", category: "materials", amount: 6_102_000 },
  { id: "exp-11", date: "2026-11-10", concept: "Arena de río · 12 m³", category: "materials", amount: 936_000 },
  { id: "exp-12", date: "2026-11-12", concept: "Cerramiento provisional y campamento", category: "other", amount: 8_400_000 },
];

export const blueprints: Blueprint[] = [
  { id: "bp-arq-01", code: "ARQ-01", title: "Planta arquitectónica · Nivel 1", category: "architectural", level: "N1", format: "svg", src: "/blueprints/arq-01-planta-n1.svg", revision: "R0", illustrative: true },
  { id: "bp-arq-02", code: "ARQ-02", title: "Planta arquitectónica · Nivel 2", category: "architectural", level: "N2", format: "svg", src: "/blueprints/arq-02-planta-n2.svg", revision: "R0", illustrative: true },
  { id: "bp-arq-03", code: "ARQ-03", title: "Fachada principal", category: "architectural", level: "General", format: "svg", src: "/blueprints/arq-03-fachada.svg", revision: "R0", illustrative: true },
  { id: "bp-est-01", code: "EST-01", title: "Planta de cimentación", category: "structural", level: "N1", format: "svg", src: "/blueprints/est-01-cimentacion.svg", revision: "R0", illustrative: true },
  { id: "bp-est-02", code: "EST-02", title: "Cuadro de columnas", category: "structural", level: "General", format: "svg", src: "/blueprints/est-02-columnas.svg", revision: "R0", illustrative: true },
  { id: "bp-est-03", code: "EST-03", title: "Planta de entrepiso · vigas N2", category: "structural", level: "N2", format: "svg", src: "/blueprints/est-03-entrepiso.svg", revision: "R0", illustrative: true },
  { id: "bp-est-04", code: "EST-04", title: "Planta de cubierta · vigas", category: "structural", level: "Cubierta", format: "svg", src: "/blueprints/est-04-cubierta.svg", revision: "R0", illustrative: true },
  { id: "bp-ele-01", code: "ELE-01", title: "Instalaciones eléctricas · Nivel 1", category: "electrical", level: "N1", format: "svg", src: "/blueprints/ele-01-n1.svg", revision: "R0", illustrative: true },
  { id: "bp-hid-01", code: "HID-01", title: "Instalaciones hidrosanitarias · Nivel 1", category: "plumbing", level: "N1", format: "svg", src: "/blueprints/hid-01-n1.svg", revision: "R0", illustrative: true },
  { id: "bp-cub-01", code: "CUB-01", title: "Planta de cubiertas", category: "roof", level: "Cubierta", format: "svg", src: "/blueprints/cub-01-cubiertas.svg", revision: "R0", illustrative: true },
  { id: "bp-det-01", code: "DET-01", title: "Detalle celosía y alero", category: "details", level: "General", format: "svg", src: "/blueprints/det-01-celosia.svg", revision: "R0", illustrative: true },
  { id: "bp-det-02", code: "DET-02", title: "Detalle de carpintería y barandas", category: "details", level: "General", format: "svg", src: "/blueprints/det-02-carpinteria.svg", revision: "R0", illustrative: true },
];

export const BLUEPRINT_CATEGORY_LABEL: Record<Blueprint["category"], string> = {
  architectural: "Arquitectónicos",
  structural: "Estructurales",
  electrical: "Eléctricos",
  plumbing: "Hidrosanitarios",
  roof: "Cubiertas",
  details: "Detalles constructivos",
};
