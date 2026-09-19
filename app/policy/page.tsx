import { getRecentActions, getRecentPolicyDecisions } from "@/lib/db/queries/policy";

const DECISION_COLOR: Record<string, string> = {
  allow: "text-green-700",
  require_approval: "text-amber-700",
  block: "text-red-700",
};

export default async function PolicyPage() {
  const [decisions, actions] = await Promise.all([
    getRecentPolicyDecisions(50),
    getRecentActions(50),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Policy log</h1>
      <p className="text-sm text-gray-600">
        Every policy evaluation and every executed adapter action — the audit trail.
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Policy decisions</h2>
        {decisions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No policy decisions yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-4">When</th>
                <th className="py-1 pr-4">Action</th>
                <th className="py-1 pr-4">Decision</th>
                <th className="py-1 pr-4">Rule</th>
                <th className="py-1 pr-4">Reason</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((decision) => (
                <tr key={decision.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {decision.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{decision.action}</td>
                  <td className={`py-2 pr-4 font-medium ${DECISION_COLOR[decision.decision] ?? ""}`}>
                    {decision.decision}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{decision.ruleId}</td>
                  <td className="py-2 pr-4 text-gray-700">{decision.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Executed actions</h2>
        {actions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No actions executed yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-4">When</th>
                <th className="py-1 pr-4">Adapter</th>
                <th className="py-1 pr-4">Method</th>
                <th className="py-1 pr-4">Before</th>
                <th className="py-1 pr-4">After</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {action.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{action.adapter}</td>
                  <td className="py-2 pr-4">{action.method}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {action.before ? JSON.stringify(action.before) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {action.after ? JSON.stringify(action.after) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
