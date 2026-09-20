import type { ActionRow } from "@/lib/db/schema";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActivity } from "@/components/icons";

export function ActionsTimeline({ actions }: { actions: ActionRow[] }) {
  return (
    <Section title="Timeline">
      {actions.length === 0 ? (
        <EmptyState icon={IconActivity} title="No actions taken yet" />
      ) : (
        <ol className="flex flex-col gap-2">
          {actions.map((action) => (
            <li key={action.id}>
              <Card>
                <CardBody className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{action.method}</span>
                    <span className="text-xs text-slate-400">{action.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-medium text-slate-400">Before</p>
                      <pre className="mt-0.5 overflow-x-auto rounded-md bg-slate-50 p-2">
                        {JSON.stringify(action.before)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium text-slate-400">After</p>
                      <pre className="mt-0.5 overflow-x-auto rounded-md bg-slate-50 p-2">
                        {JSON.stringify(action.after)}
                      </pre>
                    </div>
                  </div>
                  {action.recommendationId && (
                    <p className="mt-2 text-xs text-slate-400">
                      From recommendation {action.recommendationId.slice(0, 8)}
                    </p>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
