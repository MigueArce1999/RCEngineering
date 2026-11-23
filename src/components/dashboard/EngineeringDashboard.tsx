"use client";

import { MotionConfig, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { loaders, preloadScreens } from "@/lib/preload";
import { Navbar } from "@/components/layout/Navbar";
import { HeaderActions, WelcomeHeading } from "@/components/layout/DashboardHeader";
import { ArchitecturalViewer } from "@/components/viewer/ArchitecturalViewer";
import { Toaster, TooltipProvider } from "@/components/ui/overlays";
import { useProjectStore } from "@/stores/projectStore";
import { useAuth, useCan } from "@/stores/authStore";
import { useComments } from "@/stores/commentsStore";
import { asset } from "@/lib/asset";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { NoProjects, SetupProgressCard } from "@/components/setup/SetupProgress";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { DEMO_NOTICE } from "@/data/demo";
import { StagePanel } from "./StagePanel";
import { StageDetailDrawer } from "./StageDetailDrawer";
import { ProjectInfoCard } from "./ProjectInfoCard";
import { ActivityTimeline, FinanceOverview, InventoryWidget, MaterialsWidget, QuoteSummary } from "./widgets";

// Pantallas secundarias: se cargan aparte y se precargan en segundo plano
const ModulePanels = dynamic(() => loaders.panels().then((m) => m.ModulePanels), { ssr: false });
const QuickQuoteModal = dynamic(() => loaders.quote().then((m) => m.QuickQuoteModal), { ssr: false });
const DocsWorkspace = dynamic(() => loaders.blueprints().then((m) => m.DocsWorkspace), { ssr: false });
const SearchCommand = dynamic(() => loaders.search().then((m) => m.SearchCommand), { ssr: false });

// Entrada estilo Apple: sube y aparece con frenado largo (solo transform/opacity: fluido en la GPU)
const APPLE = [0.32, 0.72, 0, 1] as const;
const hidden = { opacity: 0, y: 16 };
const shown = { opacity: 1, y: 0 };
const rise = (delay: number) => ({
  initial: hidden,
  animate: shown,
  transition: { duration: 0.7, delay, ease: APPLE },
});
/** Igual que rise, pero se dispara al entrar en pantalla al hacer scroll */
const reveal = (delay: number) => ({
  initial: hidden,
  whileInView: shown,
  viewport: { once: true, amount: 0.08 },
  transition: { duration: 0.7, delay, ease: APPLE },
});

/**
 * Entrada de la app: con Supabase exige sesión (pantalla de acceso) antes del dashboard.
 * Sin Supabase (modo local) muestra el dashboard directamente.
 */
export function EngineeringDashboard() {
  const remote = useProjectStore((s) => s.source === "remote");
  const ready = useAuth((s) => s.ready);
  const session = useAuth((s) => s.session);
  const recovery = useAuth((s) => s.recovery);

  useEffect(() => (remote ? useAuth.getState().init() : undefined), [remote]);

  if (!remote) return <Dashboard />;
  if (!ready) return <Splash />;
  if (recovery) return <AuthScreen key="reset" initialMode="reset" />;
  if (!session) return <AuthScreen key="auth" />;
  return <Dashboard key={session.user.id} />;
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-busy="true" aria-label="Cargando">
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: APPLE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/branding/rc-isotype.svg")} alt="RC Engineering" className="h-12 w-auto animate-pulse" />
      </motion.div>
    </div>
  );
}

/** Centro de control del proyecto: composición principal del Home. */
function Dashboard() {
  // Rehidratar el estado persistido después del primer render (evita desajustes SSR)
  useEffect(() => {
    if (useProjectStore.getState().source === "local") void useProjectStore.persist.rehydrate();
    else void useProjectStore.getState().load();
  }, []);

  const remote = useProjectStore((s) => s.source === "remote");
  const loadState = useProjectStore((s) => s.loadState);
  const hasProjects = useProjectStore((s) => s.projects.length > 0);
  const loaded = !remote || loadState === "ready" || loadState === "error";
  const canManage = useCan("projects.manage");
  useEffect(() => {
    if (!loaded) return;
    preloadScreens();
    // Los administradores reciben los comentarios de clientes al instante
    if (remote && canManage) {
      useComments.getState().start();
      return () => useComments.getState().stop();
    }
  }, [loaded, remote, canManage]);
  if (!loaded) return <Splash />;
  const empty = remote && !hasProjects;

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: APPLE }}>
      <TooltipProvider>
        <Navbar />
        {empty ? (
          <main id="inicio" className="mx-auto max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8">
            <NoProjects />
          </main>
        ) : (
        <main id="inicio" className="mx-auto max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8">
          <SetupProgressCard />
          {/* Encabezado + zona principal */}
          <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(290px,25%)_1fr]">
            <motion.div {...rise(0)}>
              <WelcomeHeading />
            </motion.div>
            <motion.div {...rise(0.05)} className="flex items-end lg:justify-end">
              <HeaderActions />
            </motion.div>

            <div className="order-last flex flex-col lg:order-none lg:h-[clamp(500px,calc(100vh-290px),600px)]">
              <StagePanel />
            </div>
            <div className="h-[440px] sm:h-[520px] lg:h-[clamp(500px,calc(100vh-290px),600px)]">
              {/* Sin motion en ancestros: el modo inmersivo usa position:fixed */}
              <ArchitecturalViewer />
            </div>
            {/* En pantallas pequeñas la ficha del proyecto va debajo del visor */}
            <div className="md:hidden">
              <ProjectInfoCard />
            </div>
          </div>

          {/* Gestión operativa y financiera */}
          <section aria-label="Gestión operativa y financiera" className="mt-6 grid items-start gap-5 md:grid-cols-2 desk:items-stretch desk:grid-cols-[1.05fr_0.95fr_1fr_1.05fr]">
            <motion.div {...reveal(0)} className="h-full">
              <QuoteSummary />
            </motion.div>
            <motion.div {...reveal(0.08)} className="h-full">
              <MaterialsWidget />
            </motion.div>
            <motion.div {...reveal(0.16)} className="flex h-full flex-col gap-5">
              <InventoryWidget />
              <FinanceOverview />
            </motion.div>
            <motion.div {...reveal(0.24)} className="h-full">
              <ActivityTimeline />
            </motion.div>
          </section>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
            <span className="flex flex-wrap items-center gap-3">
              <span>RC Engineering OS · v0.1 · Home</span>
              <SyncStatus />
            </span>
            <span>{DEMO_NOTICE}: personas, cifras y planos son ilustrativos.</span>
          </footer>
        </main>
        )}

        <SetupWizard />
        <StageDetailDrawer />
        <QuickQuoteModal />
        <DocsWorkspace />
        <ModulePanels />
        <SearchCommand />
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
