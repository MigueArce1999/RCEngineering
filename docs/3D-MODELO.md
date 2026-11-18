# Sustituir el modelo procedural por un GLB / IFC

El modelo actual se genera desde `src/lib/house/spec.ts`. Cada elemento tiene un identificador
estable (`COL-N1-A3`, `VIG-N2-B`, `MUR-101`, `VEN-102`…) que usan:

- las actividades (`Task.elementIds`) para el **estado constructivo** y la vista de avance;
- el inspector (material, dimensiones, etapa, planos, costo);
- la búsqueda global.

## Pasos con un GLB

1. Exportar desde Revit / ArchiCAD / Blender a glTF binario y optimizar:
   `npx gltf-transform optimize casa.glb casa-opt.glb --compress draco --texture-compress webp`.
2. Copiar a `public/models/residencia-rc-001.glb`.
3. Asegurar que cada malla seleccionable tenga `userData.elementId` (en Blender: *Custom
   Properties* → `elementId`; glTF lo exporta como `extras`) con los mismos IDs del spec, o
   mantener una tabla de correspondencia nombre de nodo → ID.
4. Crear `GlbHouseModel.tsx` con `useGLTF("/models/residencia-rc-001.glb")` (+ `useGLTF.preload`),
   recorrer la escena, aplicar `treatmentFor()` (mismo criterio de modos que `HouseModel.tsx`) y
   los manejadores de selección por `elementId`.
5. Mover los metadatos (`ModelElement`) de `spec.ts` a la API o a un JSON por proyecto; el inspector
   y `lib/domain.ts` no cambian.
6. En `ViewerCanvas.tsx`, sustituir `<HouseModel />` por `<Suspense><GlbHouseModel /></Suspense>`.

## IFC / BIM

Para planos de instalaciones y modos eléctrico/hidrosanitario se recomienda evaluar
`web-ifc` / `@thatopen/components`: el `GlobalId` de IFC puede servir como `elementId`.
Hasta entonces esos modos se muestran como **no disponibles** en el selector de capas.
