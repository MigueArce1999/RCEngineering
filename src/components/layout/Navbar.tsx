"use client";

import Image from "next/image";
import { asset } from "@/lib/asset";
import { motion } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  Box,
  ChartColumn,
  FileText,
  House,
  Layers,
  Map,
  Package,
  Boxes,
  Search,
  Settings,
  RotateCcw,
  Menu,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn, relativeDue } from "@/lib/format";
import { useUI, type ModuleKey } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { inventoryItems } from "@/lib/domain";
import { CURRENT_USER_ID, materials, members } from "@/data/demo";
import { Avatar, Kbd, trackSpecular } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";

export const NAV_ITEMS: { key: ModuleKey; label: string; icon: typeof House; hint: string }[] = [
  { key: "home", label: "Inicio", icon: House, hint: "Centro de control del proyecto" },
  { key: "projects", label: "Proyectos", icon: Layers, hint: "Portafolio de proyectos" },
  { key: "blueprints", label: "Planos", icon: Map, hint: "Visor de planos técnicos" },
  { key: "viewer3d", label: "3D", icon: Box, hint: "Vista 3D inmersiva" },
  { key: "quotes", label: "Cotizaciones", icon: FileText, hint: "Cotizaciones del proyecto" },
  { key: "materials", label: "Materiales", icon: Boxes, hint: "Abastecimiento de materiales" },
  { key: "inventory", label: "Inventario", icon: Package, hint: "Bodega y movimientos" },
  { key: "finance", label: "Finanzas", icon: ChartColumn, hint: "Presupuesto y ejecución" },
];

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#inicio" className="flex shrink-0 items-center gap-3" aria-label="RC Engineering & Technology Group — Inicio">
      <Image src={asset("/branding/rc-isotype.svg")} alt="" width={64} height={36} priority className="h-8 w-auto sm:h-9" />
      {!compact && (
        <>
          <span className="hidden h-8 w-px bg-line-strong sm:block" aria-hidden />
          <span className="hidden text-[15px] leading-[1.15] font-medium tracking-[-0.01em] text-ink sm:block">
            RC Engineering &amp;
            <br />
            Technology Group
          </span>
        </>
      )}
    </a>
  );
}

export function navigateTo(key: ModuleKey) {
  const ui = useUI.getState();
  {
    switch (key) {
      case "home":
        ui.openModule("home");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "blueprints":
        ui.openBlueprints();
        break;
      case "viewer3d":
        ui.setImmersive(true);
        break;
      default:
        ui.openModule(key);
    }
  }
}

export function Navbar() {
  const activeModule = useUI((s) => s.module);
  const blueprintOpen = useUI((s) => s.blueprintOpen);
  const immersive = useUI((s) => s.immersive);
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const navigate = navigateTo;
  const [mobileOpen, setMobileOpen] = useState(false);

  const active: ModuleKey = blueprintOpen ? "blueprints" : immersive ? "viewer3d" : activeModule;

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <BrandLogo />

        <nav aria-label="Módulos" className="mx-auto hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.key;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Tooltip content={item.hint}>
                    <button
                      onClick={() => navigate(item.key)}
                      onPointerMove={trackSpecular}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "specular relative flex h-[54px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-[14px] px-3 text-[12px] font-medium transition-colors duration-150",
                        isActive ? "text-white" : "text-ink-2 hover:bg-surface-2/80 hover:text-ink",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="glass-brand absolute inset-0 -z-0 rounded-[14px]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Icon size={19} strokeWidth={1.7} className="relative" />
                      <span className="relative">{item.label}</span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <button
            onClick={() => setCommandOpen(true)}
            className="glass hidden h-10 w-[260px] items-center gap-2.5 rounded-full px-3.5 text-left text-[13px] text-ink-3 transition hover:text-ink-2 md:flex 2xl:w-[300px]"
            aria-label="Buscar proyecto, plano, material (Ctrl + K)"
          >
            <Search size={17} className="text-ink-2" />
            <span className="flex-1 truncate">Buscar proyecto, plano, material…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <button onClick={() => setCommandOpen(true)} className="glass grid h-10 w-10 place-items-center rounded-full md:hidden" aria-label="Buscar">
            <Search size={18} />
          </button>
          <Notifications />
          <ProfileMenu />
          <button
            className="glass grid h-10 w-10 place-items-center rounded-full xl:hidden"
            aria-label="Abrir menú de módulos"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Módulos" className="border-t border-line/60 px-4 pb-3 xl:hidden">
          <ul className="grid grid-cols-4 gap-1 pt-2 sm:grid-cols-8">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => {
                      navigate(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[12px] text-[11px] font-medium",
                      isActive ? "glass-brand" : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.7} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

function Notifications() {
  const tasks = useProjectStore((s) => s.tasks);
  const quotes = useProjectStore((s) => s.quotes);
  const openStage = useUI((s) => s.openStage);
  const setMaterialDetailId = useUI((s) => s.setMaterialDetailId);
  const openModule = useUI((s) => s.openModule);

  const items = useMemo(() => {
    const low = inventoryItems(materials).filter((i) => i.low);
    const due = tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const pending = quotes.filter((q) => q.status === "pending");
    return [
      ...due.map((t) => ({ id: t.id, title: t.title, meta: `Actividad · ${relativeDue(t.dueDate)}`, onClick: () => openStage(t.stageId, t.id) })),
      ...low.map((i) => ({ id: i.materialId, title: `Stock bajo: ${i.name}`, meta: "Alerta de abastecimiento", onClick: () => setMaterialDetailId(i.materialId) })),
      ...pending.map((q) => ({ id: q.id, title: `${q.code} pendiente de aprobación`, meta: q.title, onClick: () => openModule("quotes") })),
    ];
  }, [tasks, quotes, openStage, setMaterialDetailId, openModule]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="glass relative grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-white" aria-label={`Notificaciones (${items.length})`}>
          <Bell size={18} strokeWidth={1.8} />
          {items.length > 0 && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="anim-pop glass-float z-50 w-[340px] rounded-[20px] p-2">
          <p className="px-3 pt-2 pb-1 text-[13px] font-semibold text-ink">Notificaciones</p>
          <ul className="max-h-[360px] overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Popover.Close asChild>
                  <button onClick={n.onClick} className="w-full rounded-[12px] px-3 py-2.5 text-left transition hover:bg-white/80">
                    <p className="text-[13px] font-medium text-ink">{n.title}</p>
                    <p className="text-[12px] text-ink-2">{n.meta}</p>
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ProfileMenu() {
  const me = members.find((m) => m.id === CURRENT_USER_ID)!;
  const setSettingsOpen = useUI((s) => s.setSettingsOpen);
  const resetDemo = useProjectStore((s) => s.resetDemo);
  const toast = useUI((s) => s.toast);
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="rounded-full ring-2 ring-white shadow-[var(--shadow-sm)] transition hover:ring-accent/40" aria-label={`Perfil de ${me.name}`}>
          <Avatar initials={me.initials} size={40} />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={10} className="anim-pop glass-float z-50 w-64 rounded-[18px] p-1.5">
          <div className="px-3 py-2.5">
            <p className="text-[14px] font-semibold text-ink">{me.name}</p>
            <p className="text-[12px] text-ink-2">{me.role}</p>
          </div>
          <div className="hairline my-1" />
          <Dropdown.Item onSelect={() => setSettingsOpen(true)} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-white/80">
            <Settings size={16} /> Configuración
          </Dropdown.Item>
          <Dropdown.Item
            onSelect={() => {
              resetDemo();
              toast({ title: "Datos de demostración restablecidos", tone: "info" });
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-white/80"
          >
            <RotateCcw size={16} /> Restablecer demo
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
