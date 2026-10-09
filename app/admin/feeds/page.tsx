import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/admin-auth";
import Link from "next/link";

export default async function AdminFeedsPage() {
  await requireSuperadmin();

  const agencies = await prisma.agency.findMany({
    where: {
      OR: [{ feedUrl: { not: null } }, { feedSyncEnabled: true }],
    },
    select: {
      id: true,
      name: true,
      country: true,
      feedUrl: true,
      feedSyncEnabled: true,
      feedOffset: true,
      feedLastSyncedAt: true,
      feedLastError: true,
      feedLastResult: true,
      _count: { select: { properties: true } },
    },
    orderBy: [{ feedSyncEnabled: "desc" }, { feedLastSyncedAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          XML feeds
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Stav automatických CRM / multi-posting feedov. Partner docs:{" "}
          <code className="text-xs">docs/PARTNER-OUTREACH.md</code>
        </p>
      </div>

      {agencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
          Zatiaľ žiadna agentúra nemá nastavený feed URL. Po napojení CRM sa
          tu zobrazia sync stavy.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Agentúra</th>
                <th className="px-4 py-3">Sync</th>
                <th className="px-4 py-3">Inzeráty</th>
                <th className="px-4 py-3">Offset</th>
                <th className="px-4 py-3">Posledný sync</th>
                <th className="px-4 py-3">Stav</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.country}</div>
                    {a.feedUrl && (
                      <a
                        href={a.feedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block max-w-xs truncate text-xs text-blue-600"
                      >
                        {a.feedUrl}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.feedSyncEnabled ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        ON
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        OFF
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{a._count.properties}</td>
                  <td className="px-4 py-3">{a.feedOffset}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {a.feedLastSyncedAt
                      ? a.feedLastSyncedAt.toLocaleString("sk-SK")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.feedLastError ? (
                      <span className="text-red-700">{a.feedLastError}</span>
                    ) : a.feedLastResult ? (
                      <span className="text-gray-600">OK</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link href="/admin" className="text-sm text-blue-700 hover:underline">
        ← Overview
      </Link>
    </div>
  );
}
