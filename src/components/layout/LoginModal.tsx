"use client";

import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/stores/authStore";
import { Modal } from "@/components/ui/overlays";
import { GlassButton } from "@/components/ui/primitives";

const inputCls = "h-11 w-full rounded-[12px] border border-line bg-white px-3.5 text-[14px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

/** Inicio de sesión con correo y contraseña (Supabase Auth). Las cuentas se crean desde el panel de Supabase. */
export function LoginModal() {
  const open = useAuth((s) => s.loginOpen);
  const setOpen = useAuth((s) => s.setLoginOpen);
  return (
    <Modal open={open} onOpenChange={setOpen} title="Iniciar sesión" description="Accede con tu cuenta de RC Engineering para editar el proyecto." width={420}>
      {open && <LoginForm />}
    </Modal>
  );
}

function LoginForm() {
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Correo</span>
        <input type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nombre@empresa.com" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-2">Contraseña</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </label>
      {error && (
        <p role="alert" className="rounded-[12px] bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <GlassButton type="submit" variant="primary" size="lg" className="w-full justify-center" icon={<LogIn size={17} />} disabled={busy}>
        {busy ? "Ingresando…" : "Ingresar"}
      </GlassButton>
      <p className="text-center text-[12px] text-ink-3">¿No tienes cuenta? Pide acceso al administrador del proyecto.</p>
    </form>
  );
}
