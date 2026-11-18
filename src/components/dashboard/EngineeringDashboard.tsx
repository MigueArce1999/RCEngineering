"use client";

import { MotionConfig, motion } from "framer-motion";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { HeaderActions, WelcomeHeading } from "@/components/layout/DashboardHeader";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { ArchitecturalViewer } from "@/components/viewer/ArchitecturalViewer";
import { BlueprintViewer } from "@/components/viewer/BlueprintViewer";
import { QuickQuoteModal } from "@/components/quotes/QuickQuoteModal";
import { ModulePanels } from "@/components/modules/ModulePanels";
import { Toaster, TooltipProvider } from "@/components/ui/overlays";
import { useProjectStore } from "@/stores/projectStore";
import { DEMO_NOTICE } from "@/data/demo";
import { StagePanel } from "./StagePanel";
import { StageDetailDrawer } from "./StageDetailDrawer";
import { ProjectInfoCard } from "./ProjectInfoCard";
import { ActivityTimeline, FinanceOverview, InventoryWidget, MaterialsWidget, QuoteSummary } from "./widgets";

// Entrada estilo Apple: aparece desde un leve desenfoque y escala, con frenado largo
const APPLE = [0.32, 0.72, 0, 1] as const;
const hidden = { opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" };
const shown = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };
const rise = (delay: number) => ({
  initial: hidden,
  animate: shown,
  transition: { duration: 0.9, delay, ease: APPLE },
});
/** Igual que rise, pero se dispara al entrar en pantalla al hacer scroll */
const reveal = (delay: number) => ({
  initial: hidden,
  whileInView: shown,
  viewport: { once: true, amount: 0.08 },
  transition: { duration: 0.9, delay, ease: APPLE },
});

/** Centro de control del proyecto: composición principal del Home. */
export function EngineeringDashboard() {
  // Rehidratar el estado persistido después del primer render (evita desajustes SSR)
  useEffect(() => {
    useProjectStore.persist.rehydrate();
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: APPLE }}>
      <TooltipProvider>
        <Navbar />
        <main id="inicio" className="mx-auto max-w-[1600px] px-4 pt-6 pb-10 sm:px-6 lg:px-8 lg:pt-8">
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
            <span>RC Engineering OS · v0.1 · Home</span>
            <span>{DEMO_NOTICE}: personas, cifras y planos son ilustrativos.</span>
          </footer>
        </main>

        <StageDetailDrawer />
        <QuickQuoteModal />
        <BlueprintViewer />
        <ModulePanels />
        <SearchCommand />
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
