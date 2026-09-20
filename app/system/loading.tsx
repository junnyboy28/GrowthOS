import { SkeletonPage } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <SkeletonPage rows={3} />
    </main>
  );
}
