import { SkeletonPage } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <SkeletonPage rows={4} />
    </main>
  );
}
