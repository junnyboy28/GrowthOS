import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { OnboardingForm } from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <PageHeader
        eyebrow="Setup"
        title="Onboard your business"
        description="Tell GrowthOS about the business, the goal, and the budget — the pipeline takes it from there."
      />
      <Card>
        <CardBody>
          <OnboardingForm />
        </CardBody>
      </Card>
    </main>
  );
}
