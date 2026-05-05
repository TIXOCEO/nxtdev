"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileGeneral } from "@/lib/actions/public/profile";

export interface GeneralMemberVM {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
}

export function GeneralTab({
  tenantId,
  member,
}: {
  tenantId: string;
  member: GeneralMemberVM;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState({
    first_name: member.first_name ?? "",
    last_name: member.last_name ?? "",
    phone: member.phone ?? "",
    birth_date: member.birth_date ?? "",
    gender: member.gender ?? "",
    street: member.street ?? "",
    house_number: member.house_number ?? "",
    postal_code: member.postal_code ?? "",
    city: member.city ?? "",
  });

  function field<K extends keyof typeof state>(k: K, v: string) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateProfileGeneral({
        tenant_id: tenantId,
        member_id: member.id,
        first_name: state.first_name,
        last_name: state.last_name,
        phone: state.phone,
        birth_date: state.birth_date,
        gender: state.gender as "male" | "female" | "other" | "",
        street: state.street,
        house_number: state.house_number,
        postal_code: state.postal_code,
        city: state.city,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Je gegevens zijn opgeslagen." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card title="Persoonlijke gegevens">
        <Grid>
          <Text label="Voornaam" value={state.first_name} onChange={(v) => field("first_name", v)} required />
          <Text label="Achternaam" value={state.last_name} onChange={(v) => field("last_name", v)} required />
          <Text label="E-mail" value={member.email ?? ""} onChange={() => {}} disabled hint="E-mail wijzigen via support." />
          <Text label="Telefoon" value={state.phone} onChange={(v) => field("phone", v)} type="tel" />
          <Text label="Geboortedatum" value={state.birth_date} onChange={(v) => field("birth_date", v)} type="date" />
          <Select
            label="Geslacht"
            value={state.gender}
            onChange={(v) => field("gender", v)}
            options={[
              { v: "", l: "—" },
              { v: "male", l: "Man" },
              { v: "female", l: "Vrouw" },
              { v: "other", l: "Anders" },
            ]}
          />
        </Grid>
      </Card>

      <Card title="Adres">
        <Grid>
          <Text label="Straat" value={state.street} onChange={(v) => field("street", v)} />
          <Text label="Huisnummer" value={state.house_number} onChange={(v) => field("house_number", v)} />
          <Text label="Postcode" value={state.postal_code} onChange={(v) => field("postal_code", v)} />
          <Text label="Plaats" value={state.city} onChange={(v) => field("city", v)} />
        </Grid>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {msg && (
          <span className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
            {msg.text}
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: "#b6d83b", color: "#111" }}
        >
          {pending ? "Bezig…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--surface-main)", borderColor: "var(--surface-border)" }}
    >
      <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Text(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
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
        disabled={props.disabled}
        className="mt-1 block h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none disabled:opacity-60"
        style={{
          borderColor: "var(--surface-border)",
          color: "var(--text-primary)",
          backgroundColor: "var(--surface-soft)",
        }}
      />
      {props.hint && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {props.hint}
        </span>
      )}
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
