"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock, Mail, MailCheck, User } from "lucide-react";
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useAuth } from "@/stores/authStore";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/format";
import { Modal } from "@/components/ui/overlays";

type Mode = "login" | "signup" | "forgot" | "sent" | "reset";

const APPLE = [0.32, 0.72, 0, 1] as const;
const MIN_PASSWORD = 8;

/** Pantalla de acceso: iniciar sesión, crear cuenta, recuperar y restablecer contraseña. */
export function AuthScreen({ initialMode = "login" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [sentTo, setSentTo] = useState("");
  const [sentKind, setSentKind] = useState<"confirm" | "reset">("confirm");
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  const copy: Record<Mode, { title: string; subtitle: string }> = {
    login: { title: "Iniciar sesión", subtitle: "Accede al centro de control de tus proyectos de ingeniería, construcción y arquitectura." },
    signup: { title: "Crear cuenta", subtitle: "Únete a la plataforma de gestión de proyectos de ingeniería, construcción y arquitectura." },
    forgot: { title: "Recuperar contraseña", subtitle: "Te enviaremos un enlace para crear una contraseña nueva." },
    sent: { title: "Revisa tu correo", subtitle: "" },
    reset: { title: "Nueva contraseña", subtitle: "Elige una contraseña nueva para tu cuenta." },
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 py-10">
      <Backdrop />
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: APPLE }}
        className="relative w-full max-w-[520px] rounded-[32px] border border-[rgb(16_41_31/0.06)] bg-white/90 px-6 py-10 shadow-[0_2px_6px_rgb(16_41_31/0.04),0_40px_80px_-40px_rgb(16_41_31/0.35)] backdrop-blur-2xl sm:px-12"
        aria-labelledby="auth-title"
      >
        <div className="flex items-center justify-center gap-4">
          <Image src={asset("/branding/rc-isotype.svg")} alt="RC" width={92} height={50} priority className="h-11 w-auto" />
          <span className="h-11 w-px bg-line-strong" aria-hidden />
          <span className="text-[17px] leading-[1.2] font-medium tracking-[-0.01em] text-ink">
            RC Engineering &amp;
            <br />
            Technology Group
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 18, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -18, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: APPLE }}
          >
            <h1 id="auth-title" className="mt-9 text-center text-[34px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink sm:text-[38px]">
              {copy[mode].title}
            </h1>
            {copy[mode].subtitle && <p className="mx-auto mt-3 max-w-[380px] text-center text-[15px] leading-[1.5] text-ink-2">{copy[mode].subtitle}</p>}

            <div className="mt-8">
              {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} />}
              {mode === "signup" && (
                <SignUpForm
                  onLegal={setLegal}
                  onSent={(email) => {
                    setSentTo(email);
                    setSentKind("confirm");
                    setMode("sent");
                  }}
                />
              )}
              {mode === "forgot" && (
                <ForgotForm
                  onSent={(email) => {
                    setSentTo(email);
                    setSentKind("reset");
                    setMode("sent");
                  }}
                />
              )}
              {mode === "sent" && <SentNotice email={sentTo} kind={sentKind} />}
              {mode === "reset" && <ResetForm />}
            </div>

            {mode !== "reset" && (
              <div className="mt-8 flex items-center gap-4 text-[14px] text-ink-2">
                <span className="h-px flex-1 bg-line" aria-hidden />
                {mode === "login" ? (
                  <span>
                    ¿No tienes cuenta?{" "}
                    <button onClick={() => setMode("signup")} className="font-semibold text-brand underline-offset-4 hover:underline">
                      Crear cuenta
                    </button>
                  </span>
                ) : mode === "signup" ? (
                  <span>
                    ¿Ya tienes una cuenta?{" "}
                    <button onClick={() => setMode("login")} className="font-semibold text-brand underline-offset-4 hover:underline">
                      Inicia sesión
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setMode("login")} className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline">
                    <ArrowLeft size={15} /> Volver a iniciar sesión
                  </button>
                )}
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.section>

      <LegalModal doc={legal} onClose={() => setLegal(null)} />
    </main>
  );
}

/** Curvas corporativas sólidas en las esquinas (sin degradados). */
function Backdrop() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <motion.path
        d="M0 0 H560 C380 40 220 150 120 330 C70 420 30 470 0 500 Z"
        fill="#063d32"
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.4, ease: APPLE }}
      />
      <motion.path
        d="M0 0 H700 C470 70 300 190 190 380 C120 500 60 560 0 600 Z"
        fill="#063d32"
        opacity={0.08}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ duration: 1.6, delay: 0.2, ease: APPLE }}
      />
      <motion.path
        d="M1440 900 H980 C1150 860 1290 770 1370 640 C1410 580 1430 540 1440 520 Z"
        fill="#063d32"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.4, delay: 0.1, ease: APPLE }}
      />
      <motion.path
        d="M1440 900 H820 C1060 840 1250 720 1360 540 C1400 470 1425 420 1440 390 Z"
        fill="#063d32"
        opacity={0.07}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.07 }}
        transition={{ duration: 1.6, delay: 0.3, ease: APPLE }}
      />
    </svg>
  );
}

// ── Campos ──────────────────────────────────────────────────────────────
function Field({ icon, trailing, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode; trailing?: ReactNode }) {
  return (
    <label className={cn("group flex h-14 items-center gap-3 rounded-[16px] border border-line bg-[#fafbfa] px-4 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-within:border-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/10 hover:border-line-strong", className)}>
      <span className="text-ink-3 transition-colors group-focus-within:text-brand" aria-hidden>
        {icon}
      </span>
      <input {...rest} className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none" />
      {trailing}
    </label>
  );
}

function PasswordField({ value, onChange, placeholder = "Contraseña", autoComplete }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      icon={<Lock size={19} strokeWidth={1.7} />}
      type={show ? "text" : "password"}
      required
      minLength={autoComplete === "new-password" ? MIN_PASSWORD : undefined}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} className="text-ink-3 transition-colors hover:text-ink" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
          {show ? <EyeOff size={19} strokeWidth={1.7} /> : <Eye size={19} strokeWidth={1.7} />}
        </button>
      }
    />
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-brand text-[16px] font-semibold text-white shadow-[0_1px_2px_rgb(3_40_32/0.25),0_14px_30px_-14px_rgb(3_40_32/0.6)] transition-[background-color,transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-brand-2 active:translate-y-0 active:scale-[0.98] disabled:opacity-60"
    >
      {children}
      {!busy && <ArrowRight size={19} className="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5" />}
    </button>
  );
}

function ErrorText({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: APPLE }}
          className="overflow-hidden rounded-[14px] bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// ── Formularios ─────────────────────────────────────────────────────────
function LoginForm({ onForgot }: { onForgot: () => void }) {
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
    <form onSubmit={submit} onChange={() => setError(null)} className="space-y-4">
      <Field icon={<Mail size={19} strokeWidth={1.7} />} type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex justify-end">
        <button type="button" onClick={onForgot} className="text-[14px] font-medium text-brand underline-offset-4 hover:underline">
          ¿Olvidaste tu contraseña?
        </button>
      </div>
      <ErrorText error={error} />
      <SubmitButton busy={busy}>{busy ? "Ingresando…" : "Iniciar sesión"}</SubmitButton>
    </form>
  );
}

function SignUpForm({ onSent, onLegal }: { onSent: (email: string) => void; onLegal: (d: "terms" | "privacy") => void }) {
  const signUp = useAuth((s) => s.signUp);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (!accepted) return setError("Debes aceptar los Términos de uso y la Política de privacidad.");
    setBusy(true);
    const res = await signUp({ firstName, lastName, email, password });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.needsConfirmation) onSent(email.trim().toLowerCase());
  };

  return (
    <form onSubmit={submit} onChange={() => setError(null)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field icon={<User size={19} strokeWidth={1.7} />} required autoComplete="given-name" autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" aria-label="Nombre" maxLength={80} />
        <Field icon={<User size={19} strokeWidth={1.7} />} required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" aria-label="Apellido" maxLength={80} />
      </div>
      <Field icon={<Mail size={19} strokeWidth={1.7} />} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
      <div>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
        <p className={cn("mt-2 pl-1 text-[12px] transition-colors", password.length >= MIN_PASSWORD ? "text-[#13704a]" : "text-ink-3")}>Mínimo {MIN_PASSWORD} caracteres</p>
      </div>
      <div className="flex items-start gap-3 pt-1 text-[14px] text-ink-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={accepted}
          onClick={() => {
            setAccepted((v) => !v);
            setError(null);
          }}
          className={cn(
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border transition-colors duration-200",
            accepted ? "border-brand bg-brand text-white" : "border-line-strong bg-white hover:border-accent",
          )}
          aria-label="Acepto los Términos de uso y la Política de privacidad"
        >
          <motion.span initial={false} animate={{ scale: accepted ? 1 : 0, opacity: accepted ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
            <Check size={15} strokeWidth={3} />
          </motion.span>
        </button>
        <span>
          Acepto los{" "}
          <button type="button" onClick={() => onLegal("terms")} className="font-semibold text-brand underline-offset-4 hover:underline">
            Términos de uso
          </button>{" "}
          y la{" "}
          <button type="button" onClick={() => onLegal("privacy")} className="font-semibold text-brand underline-offset-4 hover:underline">
            Política de privacidad
          </button>
        </span>
      </div>
      <ErrorText error={error} />
      <SubmitButton busy={busy}>{busy ? "Creando cuenta…" : "Crear cuenta"}</SubmitButton>
    </form>
  );
}

function ForgotForm({ onSent }: { onSent: (email: string) => void }) {
  const send = useAuth((s) => s.sendPasswordReset);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await send(email);
    setBusy(false);
    if (err) setError(err);
    else onSent(email.trim().toLowerCase());
  };
  return (
    <form onSubmit={submit} onChange={() => setError(null)} className="space-y-4">
      <Field icon={<Mail size={19} strokeWidth={1.7} />} type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" />
      <ErrorText error={error} />
      <SubmitButton busy={busy}>{busy ? "Enviando…" : "Enviar enlace"}</SubmitButton>
    </form>
  );
}

function ResetForm() {
  const update = useAuth((s) => s.updatePassword);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    setBusy(true);
    setError(await update(password));
    setBusy(false);
  };
  return (
    <form onSubmit={submit} onChange={() => setError(null)} className="space-y-4">
      <PasswordField value={password} onChange={setPassword} autoComplete="new-password" placeholder="Nueva contraseña" />
      <ErrorText error={error} />
      <SubmitButton busy={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</SubmitButton>
    </form>
  );
}

function SentNotice({ email, kind }: { email: string; kind: "confirm" | "reset" }) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
        className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-brand"
      >
        <MailCheck size={28} strokeWidth={1.6} />
      </motion.span>
      <p className="mt-5 max-w-[380px] text-[15px] leading-[1.55] text-ink-2">
        {kind === "confirm" ? "Enviamos un enlace de confirmación a " : "Enviamos un enlace para restablecer tu contraseña a "}
        <strong className="font-semibold text-ink">{email}</strong>.{" "}
        {kind === "confirm" ? "Ábrelo para activar tu cuenta y luego inicia sesión." : "Ábrelo desde este mismo navegador."}
      </p>
      <p className="mt-3 text-[13px] text-ink-3">¿No llegó? Revisa la carpeta de spam.</p>
    </div>
  );
}

function LegalModal({ doc, onClose }: { doc: null | "terms" | "privacy"; onClose: () => void }) {
  return (
    <Modal open={!!doc} onOpenChange={(v) => !v && onClose()} title={doc === "privacy" ? "Política de privacidad" : "Términos de uso"} description="Borrador · pendiente de revisión legal" width={560}>
      {doc === "privacy" ? (
        <div className="space-y-3 text-[14px] leading-[1.6] text-ink-2">
          <p>RC Engineering &amp; Technology Group usa tu nombre, apellido y correo para crear tu cuenta, identificarte en la plataforma y controlar tus permisos según el rol asignado.</p>
          <p>La información de los proyectos se almacena en Supabase y solo es visible para usuarios autenticados con permiso de consulta.</p>
          <p>Puedes solicitar la corrección o eliminación de tus datos al administrador de la plataforma.</p>
        </div>
      ) : (
        <div className="space-y-3 text-[14px] leading-[1.6] text-ink-2">
          <p>La plataforma es una herramienta de gestión de proyectos de ingeniería. El acceso es personal e intransferible y cada usuario responde por las acciones realizadas con su cuenta.</p>
          <p>Los planos, cifras y modelos mostrados con la etiqueta «ilustrativo» son de demostración y no son aptos para ejecución constructiva.</p>
          <p>Los permisos de cada usuario dependen del rol asignado por un administrador.</p>
        </div>
      )}
    </Modal>
  );
}
