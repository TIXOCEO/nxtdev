"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { intakeRequestSchema, type IntakeRequestInput } from "@/lib/validation/marketing";
import { submitIntakeRequest } from "@/lib/actions/marketing/contact";
import { cn } from "@/lib/utils";

const SECTORS: { value: IntakeRequestInput["sector"]; label: string }[] = [
  { value: "sportvereniging", label: "Sportvereniging" },
  { value: "zwemschool", label: "Zwemschool" },
  { value: "sportschool", label: "Sportschool / fitness" },
  { value: "academie", label: "Academie" },
  { value: "dansschool", label: "Dansschool" },
  { value: "vechtsport", label: "Vechtsportschool" },
  { value: "anders", label: "Anders" },
];

const MEMBER_RANGES: { value: NonNullable<IntakeRequestInput["members"]>; label: string }[] = [
  { value: "<50", label: "Minder dan 50" },
  { value: "50-200", label: "50 – 200" },
  { value: "200-500", label: "200 – 500" },
  { value: "500-1000", label: "500 – 1.000" },
  { value: "1000+", label: "Meer dan 1.000" },
];

const PREFER: { value: IntakeRequestInput["preferred_contact"]; label: string }[] = [
  { value: "email", label: "E-mail" },
  { value: "telefoon", label: "Telefoon" },
  { value: "video", label: "Videogesprek" },
];

export function ContactForm() {
  const [success, setSuccess] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<IntakeRequestInput>({
    resolver: zodResolver(intakeRequestSchema),
    defaultValues: {
      name: "",
      email: "",
      organisation: "",
      role: "",
      sector: "anders",
      members: "" as never,
      preferred_contact: "email",
      phone: "",
      message: "",
      consent: false as unknown as true,
      website: "",
    },
  });

  function onSubmit(values: IntakeRequestInput) {
    setErrorBanner(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await submitIntakeRequest(values);
      if (result.ok) {
        setSuccess(
          "Bedankt! We nemen binnen één werkdag contact op om een kennismakingsgesprek te plannen.",
        );
        form.reset();
      } else {
        setErrorBanner(result.error);
        if (result.fieldErrors) {
          for (const [name, messages] of Object.entries(result.fieldErrors)) {
            const msg = messages?.[0];
            if (msg) {
              form.setError(name as keyof IntakeRequestInput, { message: msg });
            }
          }
        }
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-3xl border border-[var(--accent)] bg-[#f7fbe9] p-8 text-center">
        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent)] text-[#1c2616]">
          <CheckCircle2 className="size-7" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Aanvraag verzonden
        </h3>
        <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">{success}</p>
        <Button
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => setSuccess(null)}
        >
          Nog een aanvraag indienen
        </Button>
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-3xl border border-[var(--surface-border)] bg-white p-6 sm:p-8 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.3)]"
      noValidate
    >
      {errorBanner ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Volledige naam" error={errors.name?.message}>
          <Input
            {...form.register("name")}
            placeholder="Jouw naam"
            autoComplete="name"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="E-mailadres" error={errors.email?.message}>
          <Input
            type="email"
            {...form.register("email")}
            placeholder="naam@vereniging.nl"
            autoComplete="email"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Naam organisatie" error={errors.organisation?.message}>
          <Input
            {...form.register("organisation")}
            placeholder="Jouw vereniging of school"
            autoComplete="organization"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </Field>
        <Field label="Functie (optioneel)" error={errors.role?.message}>
          <Input
            {...form.register("role")}
            placeholder="Bestuurslid, trainer, eigenaar…"
            autoComplete="organization-title"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </Field>

        <Field label="Type organisatie" error={errors.sector?.message}>
          <Select
            value={form.watch("sector")}
            onValueChange={(v) => form.setValue("sector", v as IntakeRequestInput["sector"])}
            disabled={isPending}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Kies een sector" />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Aantal leden (optioneel)" error={errors.members?.message}>
          <Select
            value={form.watch("members") ?? ""}
            onValueChange={(v) =>
              form.setValue("members", v as NonNullable<IntakeRequestInput["members"]>)
            }
            disabled={isPending}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Kies een grootte" />
            </SelectTrigger>
            <SelectContent>
              {MEMBER_RANGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Voorkeur contact" error={errors.preferred_contact?.message}>
          <Select
            value={form.watch("preferred_contact")}
            onValueChange={(v) =>
              form.setValue("preferred_contact", v as IntakeRequestInput["preferred_contact"])
            }
            disabled={isPending}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREFER.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Telefoonnummer (optioneel)" error={errors.phone?.message}>
          <Input
            type="tel"
            {...form.register("phone")}
            placeholder="+31 6 ..."
            autoComplete="tel"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Vertel kort over jullie wensen (optioneel)" error={errors.message?.message}>
          <Textarea
            {...form.register("message")}
            placeholder="Welke vraag of uitdaging staat centraal? Hoe groot is jullie team?"
            rows={5}
            disabled={isPending}
            className="rounded-2xl resize-none"
          />
        </Field>
      </div>

      {/* Honeypot — verborgen voor mensen */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...form.register("website")}
          />
        </label>
      </div>

      <div className="mt-6 flex items-start gap-3">
        <Checkbox
          id="consent"
          checked={form.watch("consent") === true}
          onCheckedChange={(c) =>
            form.setValue("consent", c === true ? (true as const) : (false as unknown as true))
          }
          disabled={isPending}
          className="mt-0.5"
        />
        <Label htmlFor="consent" className="text-sm leading-relaxed text-[var(--text-secondary)] cursor-pointer">
          Ik ga akkoord dat NXTTRACK contact met mij opneemt om mijn aanvraag te
          bespreken en mijn gegevens daarvoor verwerkt.
        </Label>
      </div>
      {errors.consent ? (
        <p className="mt-2 text-xs text-red-600">{errors.consent.message}</p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-7 w-full sm:w-auto rounded-2xl bg-[var(--accent)] text-[#1c2616] hover:bg-[#a7cb24] h-12 px-7 text-[15px] font-semibold shadow-md shadow-[var(--accent)]/30"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Bezig met versturen…
          </>
        ) : (
          <>
            <Send className="size-4" />
            Stuur aanvraag
          </>
        )}
      </Button>

      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        We nemen binnen één werkdag contact op. Geen verplichtingen.
      </p>
    </form>
  );
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
