import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/admin-auth";

function MetricCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-sm text-gray-500">{props.label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
        {props.value.toLocaleString()}
      </div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireSuperadmin();

  const [users, agencies, properties] = await Promise.all([
    prisma.user.count(),
    prisma.agency.count(),
    prisma.property.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          Admin Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          High-level system metrics for operational control.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total users" value={users} />
        <MetricCard label="Total agencies" value={agencies} />
        <MetricCard label="Total properties" value={properties} />
      </div>
    </div>
  );
}

