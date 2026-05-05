"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Plus } from "lucide-react";
import { addChildAsParent } from "@/lib/actions/public/profile";
import { linkMinorByCode } from "@/lib/actions/tenant/invites";

export interface ChildVM {
  id: string;
  full_name: string;
  player_type: string | null;
}

export function ChildrenTab({
  tenantId,
  parentMemberId,
  children,
}: {
  tenantId: string;
  parentMemberId: string;
  children: ChildVM[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [linking, startLink] = useTransition();
  const [linkMsg, setLinkMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [adding, startAdd] = useTransition();
  const [addMsg, setAddMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [child, setChild] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    gender: "",
    player_type: "",
  });

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setLinkMsg({ kind: "err", text: "Voer een geldige koppelcode in." });
      return;
    }
    setLinkMsg(null);
    startLink(async () => {
      const res = await linkMinorByCode({ tenant_id: tenantId, invite_code: trimmed });
      if (!res.ok) {
        setLinkMsg({ kind: "err", text: res.error });
        return;
      }
      setLinkMsg({ kind: "ok", text: "Kind succesvol gekoppeld aan je account." });
      setCode("");
      router.refresh();
    });
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    startAdd(async () => {
      const res = await addChildAsParent({
        tenant_id: tenantId,
        parent_member_id: parentMemberId,
        first_name: child.first_name,
        last_name: child.last_name,
        birth_date: child.birth_date,
        gender: child.gender as "male" | "female" | "other" | "",
        player_type: child.player_type as "player" | "goalkeeper" | "",
      });
      if (!res.ok) {
        setAddMsg({ kind: "err", text: res.error });
        return;
      }
      setAddMsg({ kind: "ok", text: "Kind toegevoegd." });
      setChild({ first_name: "", last_name: "", birth_date: "", gender: "", player_type: "" });
      setAddOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Mijn kinderen
        </h3>

        {children.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Je hebt nog geen kinderen gekoppeld.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {children.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                <span>{c.full_name}</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {c.player_type === "goalkeeper" ? "Keeper" : c.player_type === "player" ? "Veldspeler" : "Gekoppeld"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setAddOpen((v) => !v);
              setAddMsg(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-soft)",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            {addOpen ? "Annuleer" : "Voeg kind toe"}
          </button>
        </div>

        {addOpen && (
          <form onSubmit={submitAdd} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Voornaam" value={child.first_name} onChange={(v) => setChild({ ...child, first_name: v })} required />
            <Input label="Achternaam" value={child.last_name} onChange={(v) => setChild({ ...child, last_name: v })} required />
            <Input label="Geboortedatum" type="date" value={child.birth_date} onChange={(v) => setChild({ ...child, birth_date: v })} />
            <Select
              label="Geslacht"
              value={child.gender}
              onChange={(v) => setChild({ ...child, gender: v })}
              options={[
                { v: "", l: "—" },
                { v: "male", l: "Jongen" },
                { v: "female", l: "Meisje" },
                { v: "other", l: "Anders" },
              ]}
            />
            <Select
              label="Type speler"
              value={child.player_type}
              onChange={(v) => setChild({ ...child, player_type: v })}
              options={[
                { v: "", l: "—" },
                { v: "player", l: "Veldspeler" },
                { v: "goalkeeper", l: "Keeper" },
              ]}
            />
            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              {addMsg && (
                <span className={addMsg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
                  {addMsg.text}
                </span>
              )}
              <button
                type="submit"
                disabled={adding}
                className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#b6d83b", color: "#111" }}
              >
                {adding ? "Bezig…" : "Voeg kind toe"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section
        className="rounded-2xl border p-4"
        style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
      >
        <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Bestaand kind koppelen via code
        </h3>
        <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          Heb je een koppelcode van de club ontvangen? Voer hem hier in.
        </p>
        <form onSubmit={submitLink} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Bijv. AB12-CD34"
            className="h-10 flex-1 rounded-xl border bg-transparent px-3 text-sm font-mono uppercase tracking-wider outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-soft)",
            }}
            disabled={linking}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={linking || code.trim().length < 4}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "#b6d83b", color: "#111" }}
          >
            <UserPlus className="h-4 w-4" />
            {linking ? "Bezig…" : "Koppel kind"}
          </button>
        </form>
        {linkMsg && (
          <p className={linkMsg.kind === "ok" ? "mt-2 text-sm text-emerald-600" : "mt-2 text-sm text-red-600"}>
            {linkMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      {props.label}
      {props.required && <span className="text-red-500"> *</span>}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        required={props.required}
        className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
          backgroundColor: "var(--surface-soft)",
        }}
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
          backgroundColor: "var(--surface-soft)",
        }}
      >
        {props.options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
