"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/format";

/** Actualiza --mx/--my para el reflejo especular que sigue al cursor. */
export function trackSpecular(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

// ── GlassCard ───────────────────────────────────────────────────────────
interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "card" | "glass" | "float" | "brand";
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = "card", className, ...rest },
  ref,
) {
  const base = {
    card: "surface-card",
    glass: "glass rounded-[var(--radius-lg)]",
    float: "glass-float rounded-[var(--radius-xl)]",
    brand: "glass-brand rounded-[var(--radius-lg)]",
  }[variant];
  return <div ref={ref} className={cn(base, className)} {...rest} />;
});

// ── GlassButton ─────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "glass" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailing?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "glass-brand specular hover:brightness-[1.06]",
  glass: "glass specular text-ink hover:bg-white/80",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  outline: "bg-white text-ink border border-line hover:border-line-strong hover:bg-surface-2/60 shadow-[var(--shadow-xs)]",
  danger: "bg-danger-soft text-danger hover:bg-[#f4d6d6]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-full",
  md: "h-10 px-4 text-[14px] gap-2 rounded-full",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-[14px]",
  icon: "h-10 w-10 rounded-full justify-center",
  "icon-sm": "h-8 w-8 rounded-full justify-center",
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "glass", size = "md", icon, trailing, className, children, onPointerMove, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      onPointerMove={(e) => {
        trackSpecular(e);
        onPointerMove?.(e);
      }}
      className={cn(
        "inline-flex select-none items-center font-medium whitespace-nowrap transition-[transform,filter,background-color,border-color,color,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
});

// ── ProgressBar ─────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  className,
  tone = "brand",
  height = 6,
  label,
}: {
  value: number; // 0–1
  className?: string;
  tone?: "brand" | "light" | "warning" | "danger";
  height?: number;
  label?: string;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = {
    brand: "progress-fill",
    light: "bg-gradient-to-r from-[#7fd3a9] to-[#bff0d5]",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn("w-full overflow-hidden rounded-full", tone === "light" ? "bg-white/15" : "progress-track", className)}
      style={{ height }}
    >
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ minWidth: v > 0 ? height : 0 }}
      />
    </div>
  );
}

// ── StatusBadge ─────────────────────────────────────────────────────────
type BadgeTone = "success" | "neutral" | "warning" | "danger" | "info" | "brand";

export function StatusBadge({ tone = "neutral", children, dot = true, className }: { tone?: BadgeTone; children: ReactNode; dot?: boolean; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    success: "bg-accent-soft text-[#13704a]",
    neutral: "bg-surface-2 text-ink-2",
    warning: "bg-warning-soft text-[#94631a]",
    danger: "bg-danger-soft text-danger",
    info: "bg-[#e5f0f7] text-info",
    brand: "bg-brand text-white",
  };
  const dots: Record<BadgeTone, string> = {
    success: "bg-accent",
    neutral: "bg-ink-3",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    brand: "bg-accent",
  };
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

// ── Card header ─────────────────────────────────────────────────────────
export function CardHeader({ icon, title, action, hint }: { icon: ReactNode; title: string; action?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center text-brand" aria-hidden>
        {icon}
      </span>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {hint}
      <div className="ml-auto">{action}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-white px-1 font-sans text-[11px] font-medium text-ink-3 shadow-[var(--shadow-xs)]">
      {children}
    </kbd>
  );
}

export function Avatar({ initials, size = 28, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#e8f1ec] to-[#d5e4dc] font-semibold text-brand ring-1 ring-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
