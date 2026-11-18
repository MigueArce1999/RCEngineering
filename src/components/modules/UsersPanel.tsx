"use client";

import { Check, Minus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/format";
import { useAuth } from "@/stores/authStore";
import { useUI } from "@/stores/uiStore";
import { Drawer } from "@/components/ui/overlays";
import { Avatar, GlassButton, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/Select";

interface RoleRow {
  id: string;
  name: string;
  description: string;
}
interface PermRow {
  id: string;
  name: string;
  description: string;
}
interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  created_at: string;
}

/** Gestión de usuarios y roles (requiere el permiso users.manage; lo valida también la base de datos). */
export function UsersPanel() {
  const open = useUI((s) => s.module === "users");
  const openModule = useUI((s) => s.openModule);
  const [tab, setTab] = useState<"users" | "roles">("users");

  return (
    <Drawer open={open} onOpenChange={(v) => !v && openModule("home")} title="Usuarios y roles" description="Asigna a cada persona el rol que define lo que puede hacer" width={760}>
      <div className="px-6 pb-3">
        <div className="flex rounded-full bg-surface-2 p-1" role="tablist" aria-label="Sección">
          {(
            [
              ["users", "Usuarios"],
              ["roles", "Roles y permisos"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("h-9 flex-1 rounded-full text-[13px] font-medium transition", tab === k ? "bg-white text-ink shadow-[var(--shadow-sm)]" : "text-ink-2 hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {open && <PanelBody tab={tab} />}
    </Drawer>
  );
}

function PanelBody({ tab }: { tab: "users" | "roles" }) {
  const me = useAuth((s) => s.session?.user.id);
  const toast = useUI((s) => s.toast);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [matrix, setMatrix] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [r, p, rp, u] = await Promise.all([
      supabase.from("roles").select("id, name, description").order("sort_order"),
      supabase.from("permissions").select("id, name, description").order("sort_order"),
      supabase.from("role_permissions").select("role_id, permission_id"),
      supabase.from("profiles").select("id, email, first_name, last_name, role_id, created_at").order("created_at"),
    ]);
    setRoles(r.data ?? []);
    setPerms(p.data ?? []);
    setMatrix(new Set((rp.data ?? []).map((x) => `${x.role_id}:${x.permission_id}`)));
    setUsers(u.data ?? []);
    if (u.error) toast({ title: "No se pudieron cargar los usuarios", description: u.error.message, tone: "warning" });
  }, [toast]);

  useEffect(() => {
    // Carga inicial al abrir el panel
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q));
  }, [users, query]);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  const changeRole = async (user: UserRow, roleId: string) => {
    if (!supabase || roleId === user.role_id) return;
    setSaving(user.id);
    const prev = user.role_id;
    setUsers((list) => list?.map((u) => (u.id === user.id ? { ...u, role_id: roleId } : u)) ?? null);
    const { error } = await supabase.rpc("set_user_role", { target: user.id, new_role: roleId });
    setSaving(null);
    if (error) {
      setUsers((list) => list?.map((u) => (u.id === user.id ? { ...u, role_id: prev } : u)) ?? null);
      toast({ title: "No se pudo cambiar el rol", description: error.message, tone: "warning" });
    } else {
      toast({ title: "Rol actualizado", description: `${user.first_name || user.email} ahora es ${roleName(roleId)}` });
    }
  };

  if (tab === "roles")
    return (
      <div className="space-y-4 px-6 pb-6">
        <div className="overflow-x-auto rounded-[16px] ring-1 ring-line">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="bg-surface-2/70 text-[11px] tracking-wide text-ink-3 uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Permiso</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-2 py-2.5 text-center font-medium">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70 bg-white">
              {perms.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-[12px] text-ink-3">{p.description}</p>
                  </td>
                  {roles.map((r) => (
                    <td key={r.id} className="px-2 py-3 text-center">
                      {matrix.has(`${r.id}:${p.id}`) ? (
                        <Check size={17} className="mx-auto text-accent" aria-label="Permitido" />
                      ) : (
                        <Minus size={17} className="mx-auto text-line-strong" aria-label="No permitido" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <li key={r.id} className="rounded-[14px] bg-surface-2/60 px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">{r.name}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{r.description}</p>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-[12px] text-ink-3">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" /> Los permisos se aplican en la base de datos (RLS): aunque alguien manipule la app, no puede hacer más de lo que su rol permite.
        </p>
      </div>
    );

  return (
    <div className="space-y-4 px-6 pb-6">
      <div className="flex gap-2">
        <label className="glass flex h-10 flex-1 items-center gap-2 rounded-full px-3.5 focus-within:ring-2 focus-within:ring-accent/40">
          <Search size={16} className="text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o correo…" className="h-full flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3 focus-visible:outline-none" aria-label="Buscar usuario" />
        </label>
        <GlassButton variant="outline" size="icon" onClick={() => void load()} aria-label="Recargar usuarios">
          <RefreshCw size={16} />
        </GlassButton>
      </div>

      {users === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[16px] bg-white ring-1 ring-line">
          {filtered.map((u) => {
            const name = `${u.first_name} ${u.last_name}`.trim();
            const self = u.id === me;
            return (
              <li key={u.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar initials={((u.first_name[0] ?? "") + (u.last_name[0] ?? "")).toUpperCase() || u.email.slice(0, 2).toUpperCase()} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {name || u.email} {self && <span className="text-[12px] font-normal text-ink-3">(tú)</span>}
                    </p>
                    <p className="truncate text-[12px] text-ink-2">
                      {u.email} · desde {formatDate(u.created_at.slice(0, 10))}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-[220px]">
                  {self ? (
                    <p className="text-[13px] text-ink-2">{roleName(u.role_id)} · no puedes cambiar tu propio rol</p>
                  ) : (
                    <Select
                      size="sm"
                      label={`Rol de ${name || u.email}`}
                      value={u.role_id}
                      onChange={(v) => void changeRole(u, v)}
                      options={roles.map((r) => ({ value: r.id, label: r.name }))}
                      className={cn(saving === u.id && "opacity-60")}
                    />
                  )}
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-ink-3">Sin usuarios para esta búsqueda.</li>}
        </ul>
      )}
      <p className="text-[12px] text-ink-3">Las cuentas nuevas empiezan con el rol Consulta (solo lectura). Cambia el rol para darles permisos de edición.</p>
    </div>
  );
}
