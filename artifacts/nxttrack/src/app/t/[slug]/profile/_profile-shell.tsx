"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab, type GeneralMemberVM } from "./_general-tab";
import { SportTab, type SportMemberVM } from "./_sport-tab";
import { FinancialTab, type FinancialVM } from "./_financial-tab";
import { ChildrenTab, type ChildVM } from "./_children-tab";
import type { PaymentMethod } from "@/types/database";

export interface ProfileShellProps {
  tenantId: string;
  primaryMember: GeneralMemberVM;
  sportMember: SportMemberVM | null;
  financial: FinancialVM | null;
  paymentMethods: PaymentMethod[];
  isParent: boolean;
  isAthleteOrTrainer: boolean;
  canViewIban: boolean;
  canManageIban: boolean;
  children: ChildVM[];
  athleteCodeDisplay: string | null;
}

type TabKey = "general" | "children" | "sport" | "financial";

export function ProfileShell(props: ProfileShellProps) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as TabKey | null) ?? "general";
  const [tab, setTab] = useState<TabKey>(initial);

  // Keep the URL in sync without scroll-jumping.
  useEffect(() => {
    const current = params.get("tab") ?? "general";
    if (current === tab) return;
    const next = new URLSearchParams(params.toString());
    if (tab === "general") next.delete("tab");
    else next.set("tab", tab);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [tab, params, router]);

  const onChange = useCallback((value: string) => {
    setTab(value as TabKey);
  }, []);

  const showSport = props.isAthleteOrTrainer || props.sportMember !== null;
  const showFinancial = true; // self-or-admin gate is enforced server-side
  const showChildren = props.isParent;

  return (
    <Tabs value={tab} onValueChange={onChange} className="w-full">
      <TabsList className="flex w-full flex-wrap gap-1 bg-transparent p-0">
        <Trigger value="general" label="Algemeen" />
        {showChildren && <Trigger value="children" label="Kinderen" />}
        {showSport && <Trigger value="sport" label="Sport" />}
        {showFinancial && <Trigger value="financial" label="Financieel" />}
      </TabsList>

      <TabsContent value="general" className="mt-4">
        <GeneralTab tenantId={props.tenantId} member={props.primaryMember} />
      </TabsContent>

      {showChildren && (
        <TabsContent value="children" className="mt-4">
          <ChildrenTab
            tenantId={props.tenantId}
            parentMemberId={props.primaryMember.id}
            children={props.children}
          />
        </TabsContent>
      )}

      {showSport && (
        <TabsContent value="sport" className="mt-4">
          <SportTab
            tenantId={props.tenantId}
            member={props.sportMember ?? toSportVM(props.primaryMember)}
            athleteCode={props.athleteCodeDisplay}
          />
        </TabsContent>
      )}

      {showFinancial && (
        <TabsContent value="financial" className="mt-4">
          <FinancialTab
            tenantId={props.tenantId}
            memberId={props.primaryMember.id}
            initial={props.financial}
            paymentMethods={props.paymentMethods}
            canViewIban={props.canViewIban}
            canManageIban={props.canManageIban}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

function Trigger({ value, label }: { value: string; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-xl border px-3 py-1.5 text-sm font-medium data-[state=active]:shadow-sm"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-soft)",
        color: "var(--text-primary)",
      }}
    >
      {label}
    </TabsTrigger>
  );
}

function toSportVM(g: GeneralMemberVM): SportMemberVM {
  return {
    id: g.id,
    player_type: null,
  };
}
