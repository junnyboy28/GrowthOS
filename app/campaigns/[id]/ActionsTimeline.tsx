import type { ActionRow } from "@/lib/db/schema";

export function ActionsTimeline({ actions }: { actions: ActionRow[] }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Timeline</h2>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No actions taken yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2">
          {actions.map((action) => (
            <li key={action.id} className="rounded border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{action.method}</span>
                <span className="text-xs text-gray-500">{action.createdAt.toLocaleString()}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>
                  <p className="font-medium text-gray-500">Before</p>
                  <pre className="overflow-x-auto">{JSON.stringify(action.before)}</pre>
                </div>
                <div>
                  <p className="font-medium text-gray-500">After</p>
                  <pre className="overflow-x-auto">{JSON.stringify(action.after)}</pre>
                </div>
              </div>
              {action.recommendationId && (
                <p className="mt-1 text-xs text-gray-400">
                  From recommendation {action.recommendationId.slice(0, 8)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
