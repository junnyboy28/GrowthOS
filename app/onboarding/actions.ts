"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createBusinessWithGoal } from "@/lib/db/queries/businesses";

const OnboardingSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  industry: z.string().min(1, "Industry is required"),
  location: z.string().min(1, "Location is required"),
  monthlyBudget: z.coerce.number().positive("Monthly budget must be a positive number"),
  goalText: z.string().min(1, "Goal is required"),
  brandNotes: z.string().optional(),
});

export interface ActionState {
  error?: string;
}

export async function createBusinessAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = OnboardingSchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry"),
    location: formData.get("location"),
    monthlyBudget: formData.get("monthlyBudget"),
    goalText: formData.get("goalText"),
    brandNotes: formData.get("brandNotes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { business } = await createBusinessWithGoal({
    name: parsed.data.name,
    industry: parsed.data.industry,
    location: parsed.data.location,
    monthlyBudget: parsed.data.monthlyBudget,
    brandNotes: parsed.data.brandNotes?.trim() ? parsed.data.brandNotes : null,
    goalText: parsed.data.goalText,
  });

  redirect(`/business/${business.id}`);
}
