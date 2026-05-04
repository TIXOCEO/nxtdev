"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRegistrationStatus } from "@/lib/actions/tenant/registrations";
import {
  TRYOUT_STATUSES,
  ASPIRANT_STATUSES,
  type AdminMembershipStatus,
} from "@/lib/actions/tenant/registration-statuses";

const TRYOUT_LABELS: Record<(typeof TRYOUT_STATUSES)[number], string> = {
  new: "Nieuw",
  contacted: "Gecontacteerd",
  invited: "Uitgenodigd",
  completed: "Afgerond",
  declined: "Afgewezen",
};

const ASPIRANT_LABELS: Record<(typeof ASPIRANT_STATUSES)[number], string> = {
  aspirant: "Aspirant",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  archived: "Gearchiveerd",
};

export interface RegistrationStatusSelectProps {
  id: string;
  tenantId: string;
  status: string;
  /** Registration type — drives which option set is shown. */
  type: "tryout" | "registration";
}

export function RegistrationStatusSelect({
  id,
  tenantId,
  status,
  type,
}: RegistrationStatusSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isTryout = type === "tryout";
  const options = isTryout
    ? (TRYOUT_STATUSES.map((s) => ({ value: s, label: TRYOUT_LABELS[s] })) as Array<{
        value: AdminMembershipStatus;
        label: string;
      }>)
    : (ASPIRANT_STATUSES.map((s) => ({ value: s, label: ASPIRANT_LABELS[s] })) as Array<{
        value: AdminMembershipStatus;
        label: string;
      }>);

  // If the persisted status doesn't belong to this set (e.g. a legacy row),
  // surface it as a disabled first option labelled "Onbekend: …" so admins
  // can see the real value and explicitly choose a new one without the
  // first onChange silently overwriting it with the default.
  const knownValues = new Set(options.map((o) => o.value));
  const isUnknown = !knownValues.has(status as AdminMembershipStatus);
  const initial = (isUnknown
    ? `__unknown__:${status}`
    : status) as string;

  return (
    <select
      disabled={pending}
      defaultValue={initial}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw.startsWith("__unknown__:")) return;
        const next = raw as AdminMembershipStatus;
        startTransition(async () => {
          const res = await setRegistrationStatus({
            id,
            tenant_id: tenantId,
            status: next,
          });
          if (res.ok) router.refresh();
        });
      }}
      className="h-8 rounded-lg border bg-transparent px-2 text-xs outline-none disabled:opacity-50"
      style={{
        borderColor: "var(--surface-border)",
        color: "var(--text-primary)",
        backgroundColor: "var(--surface-main)",
      }}
      aria-label="Status aanpassen"
    >
      {isUnknown && (
        <option disabled value={`__unknown__:${status}`}>
          {`Onbekend: ${status}`}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
