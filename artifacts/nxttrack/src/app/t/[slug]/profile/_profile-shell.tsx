"use client";

import { useMemo } from "react";
import { TabShell, type TabShellTab } from "@/components/ui/tab-shell";
import { GeneralTab, type GeneralMemberVM } from "./_general-tab";
import { SportTab, type SportMemberVM } from "./_sport-tab";
import { FinancialTab, type FinancialVM } from "./_financial-tab";
import { ChildrenTab, type ChildVM } from "./_children-tab";
import { TrainerBioTab } from "./_trainer-bio-tab";
import { PaymentsTab } from "./_payments-tab";
import type {
  MemberMembership,
  MembershipPaymentLog,
  MembershipPlan,
  PaymentMethod,
} from "@/types/database";
import type {
  TrainerBioAnswer,
  TrainerBioField,
  TrainerBioSection,
} from "@/lib/db/trainer-bio";

export interface TrainerBioVM {
  sections: TrainerBioSection[];
  fields: TrainerBioField[];
  answers: TrainerBioAnswer[];
}

export interface ProfileShellProps {
  tenantId: string;
  primaryMember: GeneralMemberVM;
  sportMember: SportMemberVM | null;
  financial: FinancialVM | null;
  paymentMethods: PaymentMethod[];
  isParent: boolean;
  isAthleteOrTrainer: boolean;
  isTrainer: boolean;
  trainerBio: TrainerBioVM | null;
  canViewIban: boolean;
  canManageIban: boolean;
  children: ChildVM[];
  athleteCodeDisplay: string | null;
  /** Sprint 30 — read-only Betalingen tab. */
  memberships: Array<MemberMembership & { plan: MembershipPlan | null }>;
  payments: MembershipPaymentLog[];
}

export function ProfileShell(props: ProfileShellProps) {
  const showSport = props.isAthleteOrTrainer || props.sportMember !== null;
  const showChildren = props.isParent;
  const showTrainerBio = props.isTrainer && props.trainerBio !== null;
  const showPayments = props.memberships.length > 0 || props.payments.length > 0;

  const tabs: TabShellTab[] = useMemo(
    () => [
      {
        key: "general",
        label: "Algemeen",
        content: (
          <GeneralTab tenantId={props.tenantId} member={props.primaryMember} />
        ),
      },
      {
        key: "children",
        label: "Kinderen",
        hidden: !showChildren,
        content: (
          <ChildrenTab
            tenantId={props.tenantId}
            parentMemberId={props.primaryMember.id}
            children={props.children}
          />
        ),
      },
      {
        key: "sport",
        label: "Sportprofiel",
        hidden: !showSport,
        content: (
          <SportTab
            tenantId={props.tenantId}
            member={props.sportMember ?? toSportVM(props.primaryMember)}
            athleteCode={props.athleteCodeDisplay}
          />
        ),
      },
      {
        key: "trainer_bio",
        label: "Trainersbio",
        hidden: !showTrainerBio,
        content:
          showTrainerBio && props.trainerBio ? (
            <TrainerBioTab
              tenantId={props.tenantId}
              memberId={props.primaryMember.id}
              sections={props.trainerBio.sections}
              fields={props.trainerBio.fields}
              answers={props.trainerBio.answers}
            />
          ) : null,
      },
      {
        key: "financial",
        label: "Financieel",
        content: (
          <FinancialTab
            tenantId={props.tenantId}
            memberId={props.primaryMember.id}
            initial={props.financial}
            paymentMethods={props.paymentMethods}
            canViewIban={props.canViewIban}
            canManageIban={props.canManageIban}
          />
        ),
      },
      {
        key: "payments",
        label: "Betalingen",
        hidden: !showPayments,
        content: (
          <PaymentsTab
            memberships={props.memberships}
            payments={props.payments}
            paymentMethods={props.paymentMethods}
          />
        ),
      },
    ],
    [props, showChildren, showSport, showTrainerBio, showPayments],
  );

  return <TabShell tabs={tabs} defaultKey="general" />;
}

function toSportVM(g: GeneralMemberVM): SportMemberVM {
  return {
    id: g.id,
    player_type: null,
  };
}
