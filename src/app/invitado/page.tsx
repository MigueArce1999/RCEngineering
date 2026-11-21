import type { Metadata } from "next";
import { GuestExperience } from "@/components/guest/GuestExperience";

export const metadata: Metadata = {
  title: "Proyecto · RC Engineering",
  description: "Vista privada del proyecto compartida por RC Engineering & Technology Group.",
  robots: { index: false, follow: false },
};

/** Acceso de invitados: /invitado/?t=<token> */
export default function GuestPage() {
  return <GuestExperience />;
}
