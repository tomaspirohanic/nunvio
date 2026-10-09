import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/admin-auth";

export default async function AdminAgenciesPage() {
  await requireSuperadmin();

  const agencies = await prisma.agency.findMany({
    select: {
      id: true,
      name: true,
      companyId: true,
      city: true,
      country: true,
      website: true,
      createdAt: true,
      _count: {
        select: { properties: true, users: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          Agencies
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          All registered real estate agencies on the platform.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Company ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Location
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Users
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Listings
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Public
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agencies.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No agencies yet.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {a.companyId}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.city}, {a.country}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a._count.users}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {a._count.properties}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/sk/agencies/${a.id}`}
                        className="font-medium text-blue-600 hover:underline"
                        target="_blank"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
