import { prisma } from "@/lib/db";
import UsersTable, { type AdminUserRow } from "@/components/admin/UsersTable";
import { requireSuperadmin } from "@/lib/admin-auth";

export default async function AdminUsersPage() {
  await requireSuperadmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search, audit and manage user roles.
        </p>
      </div>

      <UsersTable initialData={rows} />
    </div>
  );
}

