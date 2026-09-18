"use client";

import { useActionState, useRef } from "react";
import { SEED_BUSINESS } from "@/lib/mock/data/business";
import { createBusinessAction, type ActionState } from "./actions";

const INDUSTRIES = [
  { value: "restaurant", label: "Restaurant / Café" },
  { value: "retail", label: "Retail" },
  { value: "salon", label: "Salon & Spa" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "home-services", label: "Home Services" },
  { value: "other", label: "Other" },
] as const;

const SEED_GOAL_TEXT = "Increase weekend dinner reservations by 20% over the next 3 months";

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
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <button
        type="button"
        onClick={handlePrefill}
        className="self-start rounded border border-gray-400 px-3 py-1 text-sm hover:bg-gray-100"
      >
        Prefill from seeded restaurant
      </button>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Business name</span>
        <input
          ref={nameRef}
          name="name"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Industry</span>
        <select
          ref={industryRef}
          name="industry"
          required
          defaultValue=""
          className="rounded border border-gray-300 px-3 py-2"
        >
          <option value="" disabled>
            Select an industry
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry.value} value={industry.value}>
              {industry.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Location</span>
        <input
          ref={locationRef}
          name="location"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Monthly budget (₹)</span>
        <input
          ref={budgetRef}
          name="monthlyBudget"
          type="number"
          min="0"
          step="1"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Goal</span>
        <textarea
          ref={goalRef}
          name="goalText"
          required
          rows={3}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Brand notes (optional)</span>
        <textarea
          ref={brandNotesRef}
          name="brandNotes"
          rows={3}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create business"}
      </button>
    </form>
  );
}
