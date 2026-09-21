"use client";

import { useActionState, useRef } from "react";
import { SEED_BUSINESS, SEED_GOAL_TEXT } from "@/lib/mock/data/business";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { createBusinessAction, type ActionState } from "./actions";

const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "retail", label: "Retail" },
  { value: "salon", label: "Salon & Spa" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "home-services", label: "Home Services" },
  { value: "other", label: "Other" },
] as const;

const initialState: ActionState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);

  const nameRef = useRef<HTMLInputElement>(null);
  const industryRef = useRef<HTMLSelectElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const brandNotesRef = useRef<HTMLTextAreaElement>(null);

  function handlePrefill() {
    if (nameRef.current) nameRef.current.value = SEED_BUSINESS.name;
    if (industryRef.current) industryRef.current.value = SEED_BUSINESS.industry;
    if (locationRef.current) locationRef.current.value = SEED_BUSINESS.location;
    if (budgetRef.current) budgetRef.current.value = String(SEED_BUSINESS.monthlyBudget);
    if (goalRef.current) goalRef.current.value = SEED_GOAL_TEXT;
    if (brandNotesRef.current) brandNotesRef.current.value = SEED_BUSINESS.brandNotes;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Button type="button" variant="secondary" size="sm" onClick={handlePrefill} className="self-start">
        Prefill from seeded restaurant
      </Button>

      <Field>
        <Label>Business name</Label>
        <Input ref={nameRef} name="name" required />
      </Field>

      <Field>
        <Label>Industry</Label>
        <Select ref={industryRef} name="industry" required defaultValue="">
          <option value="" disabled>
            Select an industry
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry.value} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label>Location</Label>
        <Input ref={locationRef} name="location" required />
      </Field>

      <Field>
        <Label>Monthly budget (₹)</Label>
        <Input ref={budgetRef} name="monthlyBudget" type="number" min="0" step="1" required />
      </Field>

      <Field>
        <Label>Goal</Label>
        <Textarea ref={goalRef} name="goalText" required rows={3} />
      </Field>

      <Field>
        <Label>Brand notes (optional)</Label>
        <Textarea ref={brandNotesRef} name="brandNotes" rows={3} />
      </Field>

      {state.error && <p className="text-sm text-stop">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create business"}
      </Button>
    </form>
  );
}
