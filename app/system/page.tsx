import { getSystemStats } from "@/lib/db/queries/system";

const DECISION_COLOR: Record<string, string> = {
  allow: "text-green-700",
  require_approval: "text-amber-700",
  block: "text-red-700",
};

export default async function SystemPage() {
  const stats = await getSystemStats();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">System</h1>
      <p className="text-sm text-gray-600">Aggregate cost and policy activity so far.</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total LLM cost</p>
          <p className="text-lg font-semibold">₹{stats.totalCostInr.toFixed(4)}</p>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total LLM calls</p>
          <p className="text-lg font-semibold">{stats.totalCalls}</p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Calls per stage</h2>
        {stats.callsByStage.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No LLM calls yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-4">Stage</th>
                <th className="py-1 pr-4">Calls</th>
                <th className="py-1 pr-4">Cost (₹)</th>
              </tr>
            </thead>
            <tbody>
              {stats.callsByStage.map((row) => (
                <tr key={row.stage} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{row.stage}</td>
                  <td className="py-2 pr-4">{row.calls}</td>
                  <td className="py-2 pr-4">₹{row.costInr.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Policy decisions</h2>
        {stats.decisionCounts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No policy decisions yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {stats.decisionCounts.map((row) => (
              <li key={row.decision}>
                <span className={`font-medium ${DECISION_COLOR[row.decision] ?? ""}`}>
                  {row.decision}
                </span>
                : {row.count}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
