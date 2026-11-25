"use client";

import Image from "next/image";
import { asset } from "@/lib/asset";
import { loaders, prefetchPayroll } from "@/lib/preload";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronRight,
  X,
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
  LogOut,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn, relativeDue } from "@/lib/format";
import { useUI, type ModuleKey } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useComments } from "@/stores/commentsStore";
import { inventoryItems } from "@/lib/domain";
import { useCatalog } from "@/hooks/useCatalog";
import { useAuth, useCan } from "@/stores/authStore";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";

export const NAV_ITEMS: { key: ModuleKey; label: string; icon: typeof House; hint: string }[] = [
  { key: "home", label: "Inicio", icon: House, hint: "Centro de control del proyecto" },
  { key: "projects", label: "Proyectos", icon: Layers, hint: "Portafolio de proyectos" },
  { key: "blueprints", label: "Planos", icon: Map, hint: "Planos, fotos de obra y acceso de invitados" },
  { key: "viewer3d", label: "3D", icon: Box, hint: "Vista 3D inmersiva" },
  { key: "quotes", label: "Cotizaciones", icon: FileText, hint: "Cotizaciones del proyecto" },
  { key: "materials", label: "Materiales", icon: Boxes, hint: "Abastecimiento de materiales" },
  { key: "inventory", label: "Inventario", icon: Package, hint: "Bodega y movimientos" },
  { key: "finance", label: "Finanzas", icon: ChartColumn, hint: "Presupuesto y ejecución" },
  { key: "payroll", label: "Nómina", icon: Wallet, hint: "Pagos quincenales y mensuales del personal de obra" },
];

/** Módulos visibles según el rol (la nómina es información sensible). */
function useNavItems() {
  const canPayroll = useCan("payroll.manage");
  const remote = useProjectStore((s) => s.source === "remote");
  return NAV_ITEMS.filter((i) => i.key !== "payroll" || (remote && canPayroll));
}

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

/** Al pasar el cursor por un botón se adelanta el código y los datos de esa pantalla. */
function warmUp(key: ModuleKey) {
  if (key === "payroll") void prefetchPayroll();
  if (key === "blueprints") void loaders.blueprints();
  else if (key !== "home" && key !== "viewer3d") void loaders.panels();
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
  const navItems = useNavItems();

  const active: ModuleKey = blueprintOpen ? "blueprints" : immersive ? "viewer3d" : activeModule;

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <BrandLogo />

        <nav aria-label="Módulos" className="mx-auto hidden xl:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = active === item.key;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Tooltip content={item.hint}>
                    <button
                      onClick={() => navigate(item.key)}
                      onPointerEnter={() => warmUp(item.key)}
                      onFocus={() => warmUp(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-[54px] min-w-[58px] flex-col items-center justify-center gap-1 rounded-[14px] px-2.5 2xl:px-3 text-[12px] font-medium transition-colors duration-150",
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
            className="glass hidden h-10 w-[260px] items-center gap-2.5 rounded-full px-3.5 text-left text-[13px] text-ink-3 transition hover:text-ink-2 md:flex xl:w-[200px] 2xl:w-[300px]"
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

      <MobileMenu open={mobileOpen} onOpenChange={setMobileOpen} items={navItems} active={active} onSelect={navigate} onSearch={() => setCommandOpen(true)} />
    </header>
  );
}

function Notifications() {
  const { materials } = useCatalog();
  const tasks = useProjectStore((s) => s.tasks);
  const quotes = useProjectStore((s) => s.quotes);
  const openStage = useUI((s) => s.openStage);
  const setMaterialDetailId = useUI((s) => s.setMaterialDetailId);
  const openModule = useUI((s) => s.openModule);

  const comments = useComments((c) => c.items);
  const openDocs = useUI((u) => u.openDocs);
  const newOnes = useMemo(() => comments.filter((c) => c.status === "new"), [comments]);
  const items = useMemo(() => {
    const low = inventoryItems(materials).filter((i) => i.low);
    const due = tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const pending = quotes.filter((q) => q.status === "pending");
    return [
      ...newOnes.map((c) => ({ id: `cm-${c.id}`, title: `Comentario de ${c.author}`, meta: c.body.length > 70 ? `${c.body.slice(0, 70)}…` : c.body, onClick: () => openDocs("comments"), alert: true })),
      ...due.map((t) => ({ id: t.id, title: t.title, meta: `Actividad · ${relativeDue(t.dueDate)}`, onClick: () => openStage(t.stageId, t.id) })),
      ...low.map((i) => ({ id: i.materialId, title: `Stock bajo: ${i.name}`, meta: "Alerta de abastecimiento", onClick: () => setMaterialDetailId(i.materialId) })),
      ...pending.map((q) => ({ id: q.id, title: `${q.code} pendiente de aprobación`, meta: q.title, onClick: () => openModule("quotes") })),
    ];
  }, [tasks, quotes, materials, newOnes, openDocs, openStage, setMaterialDetailId, openModule]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="glass relative grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-white" aria-label={`Notificaciones (${items.length})`}>
          <Bell size={18} strokeWidth={1.8} />
          {newOnes.length > 0 ? <span className="tabular absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#e5484d] px-1 text-[10px] font-bold text-white ring-2 ring-white">{newOnes.length}</span> : items.length > 0 && <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-white" />}
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
  const setSettingsOpen = useUI((s) => s.setSettingsOpen);
  const openModule = useUI((s) => s.openModule);
  const resetDemo = useProjectStore((s) => s.resetDemo);
  const remote = useProjectStore((s) => s.source === "remote");
  const toast = useUI((s) => s.toast);
  const profile = useAuth((s) => s.profile);
  const email = useAuth((s) => s.session?.user.email ?? null);
  const signOut = useAuth((s) => s.signOut);
  const canManageUsers = useCan("users.manage");
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const initials = remote
    ? ((profile?.firstName?.[0] ?? "") + (profile?.lastName?.[0] ?? "")).toUpperCase() || (email ?? "").slice(0, 2).toUpperCase()
    : "RC";
  const itemCls = "flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2";

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button className="rounded-full ring-2 ring-white shadow-[var(--shadow-sm)] transition hover:ring-accent/40" aria-label={fullName ? `Cuenta de ${fullName}` : "Cuenta"}>
          {initials ? <Avatar initials={initials} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e2ece6] text-brand"><User size={18} /></span>}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={10} className="anim-pop glass-float z-50 w-72 rounded-[18px] p-1.5">
          <div className="px-3 py-2.5">
            {remote ? (
              <>
                <p className="truncate text-[14px] font-semibold text-ink">{fullName || email}</p>
                {fullName && <p className="truncate text-[12px] text-ink-2">{email}</p>}
                {profile && <span className="mt-2 inline-flex h-6 items-center rounded-full bg-accent-soft px-2.5 text-[12px] font-medium text-[#13704a]">{profile.roleName}</span>}
              </>
            ) : (
              <>
                <p className="text-[14px] font-semibold text-ink">Modo local</p>
                <p className="text-[12px] text-ink-2">Datos de demostración en este navegador</p>
              </>
            )}
          </div>
          <div className="hairline my-1" />
          {remote && canManageUsers && (
            <Dropdown.Item onSelect={() => openModule("users")} className={itemCls}>
              <Users size={16} /> Usuarios y roles
            </Dropdown.Item>
          )}
          <Dropdown.Item onSelect={() => setSettingsOpen(true)} className={itemCls}>
            <Settings size={16} /> Configuración
          </Dropdown.Item>
          {!remote && (
            <Dropdown.Item
              onSelect={() => {
                resetDemo();
                toast({ title: "Datos de demostración restablecidos", tone: "info" });
              }}
              className={itemCls}
            >
              <RotateCcw size={16} /> Restablecer demo
            </Dropdown.Item>
          )}
          {remote && (
            <Dropdown.Item onSelect={() => void signOut()} className={itemCls}>
              <LogOut size={16} /> Cerrar sesión
            </Dropdown.Item>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/** Menú a pantalla completa estilo iOS: capa oscura con desenfoque y lista grande. */
function MobileMenu({ open, onOpenChange, items, active, onSelect, onSearch }: { open: boolean; onOpenChange: (v: boolean) => void; items: typeof NAV_ITEMS; active: ModuleKey; onSelect: (k: ModuleKey) => void; onSearch: () => void }) {
  const ease = [0.32, 0.72, 0, 1] as const;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-[#06120d]/70 backdrop-blur-2xl backdrop-saturate-150" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-[61] flex flex-col px-5 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] focus:outline-none"
                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.38, ease }}
              >
                <div className="mx-auto flex w-full max-w-[560px] items-center justify-between pt-1">
                  <Dialog.Title className="text-[13px] font-medium tracking-[0.08em] text-white/60 uppercase">Menú</Dialog.Title>
                  <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-xl transition active:scale-95" aria-label="Cerrar menú">
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <div className="scroll-thin mx-auto mt-4 min-h-0 w-full max-w-[560px] flex-1 overflow-y-auto">
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      onSearch();
                    }}
                    className="mb-3 flex h-11 w-full items-center gap-2.5 rounded-[14px] bg-white/10 px-3.5 text-left text-[15px] text-white/60 ring-1 ring-white/12"
                  >
                    <Search size={16} /> Buscar
                  </button>
                  <ul className="divide-y divide-white/10 overflow-hidden rounded-[18px] bg-white/8 ring-1 ring-white/12">
                    {items.map((item, i) => {
                      const Icon = item.icon;
                      const isActive = active === item.key;
                      return (
                        <motion.li key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.03, duration: 0.34, ease }}>
                          <button
                            onClick={() => {
                              onOpenChange(false);
                              onSelect(item.key);
                            }}
                            aria-current={isActive ? "page" : undefined}
                            className={cn("flex w-full items-center gap-3.5 px-4 py-3 text-left text-white transition active:bg-white/10", isActive && "bg-white/14")}
                          >
                            <Icon size={19} strokeWidth={1.5} className={isActive ? "text-white" : "text-white/70"} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[16px] leading-tight font-medium">{item.label}</span>
                              <span className="mt-0.5 block truncate text-[12px] text-white/45">{item.hint}</span>
                            </span>
                            {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-[#4fd69c]" /> : <ChevronRight size={15} className="text-white/30" />}
                          </button>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
