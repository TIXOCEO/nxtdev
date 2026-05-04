"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Save, Send, Trash2, Users, UsersRound } from "lucide-react";
import { TipTapEditor } from "@/components/ui/tiptap-editor";
import { BrandedEmailPreview } from "@/components/tenant/email/branded-email-preview";
import {
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  sendNewsletterNow,
  sendNewsletterTest,
} from "@/lib/actions/tenant/newsletters";
import type { Newsletter, Tenant } from "@/types/database";

export interface GroupOption {
  id: string;
  name: string;
  member_count: number;
}

type Mode = "create" | "edit";

export interface NewsletterEditorProps {
  mode: Mode;
  tenant: Tenant;
  newsletter?: Newsletter;
  groups: GroupOption[];
}

const inputCls =
  "w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50";
const inputStyle = {
  borderColor: "var(--surface-border)",
  color: "var(--text-primary)",
  backgroundColor: "var(--surface-main)",
} as const;

export function NewsletterEditor({ mode, tenant, newsletter, groups }: NewsletterEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const [title, setTitle] = useState(newsletter?.title ?? "");
  const [preheader, setPreheader] = useState(newsletter?.preheader ?? "");
  const [html, setHtml] = useState(newsletter?.content_html ?? "");
  const [audienceType, setAudienceType] = useState<"all" | "groups">(
    newsletter?.audience_type ?? "all",
  );
  const [groupIds, setGroupIds] = useState<string[]>(newsletter?.audience_group_ids ?? []);
  const [testTo, setTestTo] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toggleGroup(id: string) {
    setGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      if (mode === "create") {
        const res = await createNewsletter({
          tenant_id: tenant.id,
          title,
          preheader: preheader || null,
          content_html: html,
          content_text: null,
          audience_type: audienceType,
          audience_group_ids: audienceType === "groups" ? groupIds : [],
        });
        if (!res.ok) {
          setMsg({ kind: "err", text: res.error });
          return;
        }
        router.push(`/tenant/newsletters/${res.data.id}`);
        router.refresh();
      } else {
        const res = await updateNewsletter({
          id: newsletter!.id,
          tenant_id: tenant.id,
          title,
          preheader: preheader || null,
          content_html: html,
          content_text: null,
          audience_type: audienceType,
          audience_group_ids: audienceType === "groups" ? groupIds : [],
        });
        if (!res.ok) {
          setMsg({ kind: "err", text: res.error });
          return;
        }
        setMsg({ kind: "ok", text: "Concept opgeslagen." });
        router.refresh();
      }
    });
  }

  function sendTest() {
    setTestMsg(null);
    if (mode === "create") {
      setTestMsg({ kind: "err", text: "Sla eerst het concept op om een test te versturen." });
      return;
    }
    startTransition(async () => {
      const res = await sendNewsletterTest({
        id: newsletter!.id,
        tenant_id: tenant.id,
        to: testTo,
      });
      setTestMsg(
        res.ok
          ? { kind: "ok", text: `Test verstuurd naar ${testTo}.` }
          : { kind: "err", text: res.error },
      );
    });
  }

  function sendNow() {
    if (mode === "create") {
      setMsg({ kind: "err", text: "Sla eerst het concept op." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await sendNewsletterNow({
        id: newsletter!.id,
        tenant_id: tenant.id,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        setConfirmSend(false);
        return;
      }
      setMsg({
        kind: "ok",
        text: `Nieuwsbrief verstuurd: ${res.data.sent_count}/${res.data.recipient_count} bezorgd${res.data.failed_count > 0 ? ` (${res.data.failed_count} mislukt)` : ""}.`,
      });
      router.refresh();
    });
  }

  function remove() {
    if (mode === "create" || !newsletter) return;
    if (!confirm("Concept verwijderen?")) return;
    startTransition(async () => {
      const res = await deleteNewsletter({
        id: newsletter.id,
        tenant_id: tenant.id,
      });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      router.push("/tenant/newsletters");
      router.refresh();
    });
  }

  const audienceSummary =
    audienceType === "all"
      ? "Alle actieve leden van de vereniging"
      : groupIds.length === 0
        ? "Geen groep geselecteerd"
        : `${groupIds.length} groep(en) geselecteerd`;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div
        className="inline-flex rounded-xl border p-1"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--surface-main)",
        }}
      >
        {(["edit", "preview"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
              style={
                active
                  ? { backgroundColor: "var(--accent)", color: "var(--text-primary)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              {t === "edit" ? "Bewerken" : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Voorbeeld
                </>
              )}
            </button>
          );
        })}
      </div>

      {tab === "edit" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Main content column */}
          <div
            className="space-y-3 rounded-2xl border p-4 sm:p-6 lg:col-span-2"
            style={{
              backgroundColor: "var(--surface-main)",
              borderColor: "var(--surface-border)",
            }}
          >
            <Field label="Titel (wordt het onderwerp van de e-mail)">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inputCls} h-10`}
                style={inputStyle}
                placeholder="Bv. Maandelijkse update — april 2026"
              />
            </Field>

            <Field
              label="Preheader (kort voorbeeld dat in de inbox naast het onderwerp verschijnt)"
              hint="Optioneel · max 200 tekens · niet zichtbaar in de body."
            >
              <input
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                maxLength={200}
                className={`${inputCls} h-10`}
                style={inputStyle}
                placeholder="Bv. Nieuwe trainingstijden, aankomende wedstrijden en meer."
              />
            </Field>

            <Field
              label="Inhoud"
              hint="Logo, footer met website-info en de uitschrijf-tekst worden automatisch toegevoegd bij verzenden."
            >
              <TipTapEditor
                value={html}
                onChange={setHtml}
                placeholder="Schrijf hier de inhoud van de nieuwsbrief..."
                minHeight={360}
              />
            </Field>

            {msg && (
              <p
                className={
                  msg.kind === "ok"
                    ? "text-sm text-emerald-600"
                    : "text-sm text-red-600"
                }
              >
                {msg.text}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
              >
                <Save className="h-4 w-4" /> {mode === "create" ? "Concept aanmaken" : "Concept opslaan"}
              </button>
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium disabled:opacity-50"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                >
                  <Trash2 className="h-4 w-4" /> Verwijder concept
                </button>
              )}
            </div>
          </div>

          {/* Sidebar: audience + send */}
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Doelgroep
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {audienceSummary}
              </p>

              <div className="mt-3 space-y-2">
                <RadioRow
                  checked={audienceType === "all"}
                  onChange={() => setAudienceType("all")}
                  icon={<Users className="h-4 w-4" />}
                  label="Alle leden"
                  desc="Stuur naar elk actief lid van deze vereniging."
                />
                <RadioRow
                  checked={audienceType === "groups"}
                  onChange={() => setAudienceType("groups")}
                  icon={<UsersRound className="h-4 w-4" />}
                  label="Specifieke groepen"
                  desc="Selecteer één of meer groepen hieronder."
                />
              </div>

              {audienceType === "groups" && (
                <div className="mt-3 space-y-1.5 rounded-xl border p-2" style={{ borderColor: "var(--surface-border)" }}>
                  {groups.length === 0 ? (
                    <p className="px-1 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      Er zijn nog geen groepen aangemaakt.
                    </p>
                  ) : (
                    groups.map((g) => (
                      <label
                        key={g.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/5"
                      >
                        <input
                          type="checkbox"
                          checked={groupIds.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="h-4 w-4"
                        />
                        <span className="flex-1" style={{ color: "var(--text-primary)" }}>
                          {g.name}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {g.member_count}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Test send */}
            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Test versturen
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Stuur de opgeslagen versie naar één e-mailadres ter controle.
              </p>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="ontvanger@voorbeeld.nl"
                className={`${inputCls} mt-2 h-10`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={sendTest}
                disabled={pending || !testTo || mode === "create"}
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"
                style={{
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                <Send className="h-3.5 w-3.5" /> Verstuur test
              </button>
              {testMsg && (
                <p
                  className={
                    testMsg.kind === "ok"
                      ? "mt-2 text-xs text-emerald-600"
                      : "mt-2 text-xs text-red-600"
                  }
                >
                  {testMsg.text}
                </p>
              )}
            </div>

            {/* Send NOW */}
            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Direct versturen
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                De nieuwsbrief gaat meteen naar de gekozen doelgroep. Dit kan niet ongedaan
                worden gemaakt.
              </p>

              {!confirmSend ? (
                <button
                  type="button"
                  onClick={() => setConfirmSend(true)}
                  disabled={pending || mode === "create"}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--text-primary)" }}
                >
                  <Send className="h-4 w-4" /> Verstuur nu
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-red-700">
                    Weet je het zeker? Dit verzendt direct naar {audienceSummary.toLowerCase()}.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={sendNow}
                      disabled={pending}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: "#dc2626" }}
                    >
                      <Send className="h-4 w-4" /> Ja, verstuur nu
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSend(false)}
                      disabled={pending}
                      className="inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium disabled:opacity-50"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Onderwerp
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title || <span style={{ color: "var(--text-secondary)" }}>Geen titel</span>}
          </p>
          <BrandedEmailPreview tenant={tenant} innerHtml={html} preheader={preheader || null} />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function RadioRow({
  checked,
  onChange,
  icon,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition-colors hover:bg-black/5"
      style={{
        borderColor: checked ? "var(--accent)" : "var(--surface-border)",
        backgroundColor: checked ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
      }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4"
      />
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {icon} {label}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {desc}
        </p>
      </div>
    </label>
  );
}
