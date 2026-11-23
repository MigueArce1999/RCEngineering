import type { Metadata, Viewport } from "next";
import { GuestExperience } from "@/components/guest/GuestExperience";

export const metadata: Metadata = {
  title: "Proyecto · RC Engineering",
  description: "Vista privada del proyecto compartida por RC Engineering & Technology Group.",
  robots: { index: false, follow: false },
};

/** Experiencia tipo app en celular: sin zoom accidental al escribir, tocar dos veces o pellizcar la página. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

/** Acceso de invitados: /invitado/?t=<token> */
export default function GuestPage() {
  return <GuestExperience />;
}
