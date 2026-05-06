"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMember } from "@/lib/actions/tenant/members";
import { MEMBER_STATUSES } from "@/lib/validation/members";
import type { Member } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  invited: "Uitgenodigd",
  aspirant: "Aspirant",
  pending: "In behandeling",
  active: "Actief",
  paused: "Gepauzeerd",
  inactive: "Inactief",
  cancelled: "Opgezegd",
  archived: "Gearchiveerd",
};

export function AdminMemberEditForm({
  tenantId,
  member,
}: {
  tenantId: string;
  member: Member;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState({
    first_name: member.first_name ?? "",
    last_name: member.last_name ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    birth_date: member.birth_date ?? "",
    gender: (member.gender as string | null) ?? "",
    player_type: (member.player_type as string | null) ?? "",
    street: member.street ?? "",
    house_number: member.house_number ?? "",
    postal_code: member.postal_code ?? "",
    city: member.city ?? "",
    member_since: member.member_since ?? "",
    notes: member.notes ?? "",
    member_status: member.member_status ?? "active",
  });

  function set<K extends keyof typeof state>(k: K, v: string) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateMember({
        id: member.id,
        tenant_id: tenantId,
        full_name:
          `${state.first_name} ${state.last_name}`.trim() || member.full_name,
        email: state.email,
        phone: state.phone,
        first_name: state.first_name,
        last_name: state.last_name,
        birth_date: state.birth_date,
        gender: (state.gender || null) as "male" | "female" | "other" | null,
        player_type: (state.player_type || null) as "player" | "goalkeeper" | null,
        street: state.street,
        house_number: state.house_number,
        postal_code: state.postal_code,
        city: state.city,
        member_since: state.member_since,
        notes: state.notes,
        member_status: state.member_status as (typeof MEMBER_STATUSES)[number],
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Wijzigingen opgeslagen." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card title="Persoonlijke gegevens">
        <Grid>
          <Text label="Voornaam" value={state.first_name} onChange={(v) => set("first_name", v)} />
          <Text label="Achternaam" value={state.last_name} onChange={(v) => set("last_name", v)} />
          <Text label="E-mail" value={state.email} onChange={(v) => set("email", v)} type="email" />
          <Text label="Telefoon" value={state.phone} onChange={(v) => set("phone", v)} type="tel" />
          <Text label="Geboortedatum" value={state.birth_date} onChange={(v) => set("birth_date", v)} type="date" />
          <Select
            label="Geslacht"
            value={state.gender}
            onChange={(v) => set("gender", v)}
            options={[
              { v: "", l: "—" },
              { v: "male", l: "Man" },
              { v: "female", l: "Vrouw" },
              { v: "other", l: "Anders" },
            ]}
          />
        </Grid>
      </Card>

      <Card title="Sport">
        <Grid>
          <Select
            label="Type speler"
            value={state.player_type}
            onChange={(v) => set("player_type", v)}
            options={[
              { v: "", l: "—" },
              { v: "player", l: "Veldspeler" },
              { v: "goalkeeper", l: "Keeper" },
            ]}
          />
          <Select
            label="Status"
            value={state.member_status}
            onChange={(v) => set("member_status", v)}
            options={MEMBER_STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] ?? s }))}
          />
        </Grid>
      </Card>

      <Card title="Adres">
        <Grid>
          <Text label="Straat" value={state.street} onChange={(v) => set("street", v)} />
          <Text label="Huisnummer" value={state.house_number} onChange={(v) => set("house_number", v)} />
          <Text label="Postcode" value={state.postal_code} onChange={(v) => set("postal_code", v)} />
          <Text label="Plaats" value={state.city} onChange={(v) => set("city", v)} />
        </Grid>
      </Card>

      <Card title="Administratief">
        <Grid>
          <Text label="Lid sinds" value={state.member_since} onChange={(v) => set("member_since", v)} type="date" />
        </Grid>
        <label className="mt-3 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Interne notities
          <textarea
            value={state.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 block w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-soft)",
            }}
          />
        </label>
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
}) {
  return (
    <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
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
