import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconAlertTriangle } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <EmptyState
        icon={IconAlertTriangle}
        title="Page not found"
        description="The page you're looking for doesn't exist or was moved."
        action={
          <LinkButton href="/" variant="primary" className="mt-2">
            Back home
          </LinkButton>
        }
      />
    </main>
  );
}
