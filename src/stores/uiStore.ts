"use client";

import { create } from "zustand";

export type ModuleKey = "home" | "projects" | "blueprints" | "viewer3d" | "quotes" | "materials" | "inventory" | "finance" | "users";

export type ViewMode = "architectural" | "structural" | "roof" | "levels" | "progress" | "exploded" | "electrical" | "plumbing";
export type CameraPreset = "iso" | "front" | "back" | "side" | "top";
export type PointerTool = "orbit" | "pan" | "zoom";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone?: "success" | "info" | "warning";
}

interface UIState {
  module: ModuleKey;
  openModule: (m: ModuleKey) => void;

  stageDrawerId: string | null;
  focusTaskId: string | null;
  openStage: (stageId: string, focusTaskId?: string | null) => void;
  closeStage: () => void;
  selectedStageId: string;

  quickQuoteOpen: boolean;
  setQuickQuoteOpen: (v: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  projectDetailOpen: boolean;
  setProjectDetailOpen: (v: boolean) => void;
  materialDetailId: string | null;
  setMaterialDetailId: (id: string | null) => void;

  blueprintId: string | null;
  blueprintOpen: boolean;
  openBlueprints: (id?: string | null) => void;
  closeBlueprints: () => void;

  // Visor 3D
  immersive: boolean;
  setImmersive: (v: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  visibleLevel: 1 | 2 | 3;
  setVisibleLevel: (l: 1 | 2 | 3) => void;
  cameraPreset: { preset: CameraPreset | "reset"; nonce: number };
  goToCamera: (p: CameraPreset | "reset") => void;
  pointerTool: PointerTool;
  setPointerTool: (t: PointerTool) => void;
  selectedElementId: string | null;
  selectElement: (id: string | null) => void;
  focusElementNonce: number;
  focusElement: (id: string) => void;
  infoCardCollapsed: boolean;
  setInfoCardCollapsed: (v: boolean) => void;
  renderQuality: "high" | "balanced";
  setRenderQuality: (q: "high" | "balanced") => void;

  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const useUI = create<UIState>()((set) => ({
  module: "home",
  openModule: (module) => set({ module }),

  stageDrawerId: null,
  focusTaskId: null,
  selectedStageId: "stg-01",
  openStage: (stageId, focusTaskId = null) => set({ stageDrawerId: stageId, selectedStageId: stageId, focusTaskId }),
  closeStage: () => set({ stageDrawerId: null, focusTaskId: null }),

  quickQuoteOpen: false,
  setQuickQuoteOpen: (quickQuoteOpen) => set({ quickQuoteOpen }),
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  projectDetailOpen: false,
  setProjectDetailOpen: (projectDetailOpen) => set({ projectDetailOpen }),
  materialDetailId: null,
  setMaterialDetailId: (materialDetailId) => set({ materialDetailId }),

  blueprintId: null,
  blueprintOpen: false,
  openBlueprints: (id = null) => set((s) => ({ blueprintOpen: true, blueprintId: id ?? s.blueprintId })),
  closeBlueprints: () => set({ blueprintOpen: false }),

  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
  viewMode: "architectural",
  setViewMode: (viewMode) => set({ viewMode }),
  visibleLevel: 3,
  setVisibleLevel: (visibleLevel) => set({ visibleLevel }),
  cameraPreset: { preset: "iso", nonce: 0 },
  goToCamera: (preset) => set((s) => ({ cameraPreset: { preset, nonce: s.cameraPreset.nonce + 1 } })),
  pointerTool: "orbit",
  setPointerTool: (pointerTool) => set({ pointerTool }),
  selectedElementId: null,
  selectElement: (selectedElementId) => set({ selectedElementId }),
  focusElementNonce: 0,
  focusElement: (id) => set((s) => ({ selectedElementId: id, focusElementNonce: s.focusElementNonce + 1 })),
  infoCardCollapsed: false,
  setInfoCardCollapsed: (infoCardCollapsed) => set({ infoCardCollapsed }),
  renderQuality: "high",
  setRenderQuality: (renderQuality) => set({ renderQuality }),

  toasts: [],
  toast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3800);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
