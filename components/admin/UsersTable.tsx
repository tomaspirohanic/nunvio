"use client";

import { useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { changeUserRole } from "@/actions/admin";
import { UserRole } from "@prisma/client";

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: string; // ISO
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function UsersTable(props: { initialData: AdminUserRow[] }) {
  const [data, setData] = useState<AdminUserRow[]>(props.initialData);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: (info) => (
          <div className="font-mono text-xs text-gray-700 truncate max-w-[220px]">
            {String(info.getValue())}
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {String(info.getValue() ?? "—")}
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: (info) => (
          <div className="text-sm text-gray-900">{String(info.getValue())}</div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: (info) => (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700">
            {String(info.getValue())}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: (info) => (
          <div className="text-sm text-gray-600">{formatDate(String(info.getValue()))}</div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const user = row.original;
          const saving = Boolean(rowSaving[user.id]);

          return (
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                value={user.role}
                disabled={saving}
                onChange={async (e) => {
                  const nextRole = e.target.value as UserRole;
                  if (nextRole === user.role) return;

                  setRowSaving((p) => ({ ...p, [user.id]: true }));
                  try {
                    const updated = await changeUserRole(user.id, nextRole);
                    setData((prev) =>
                      prev.map((u) =>
                        u.id === user.id ? { ...u, role: updated.role } : u
                      )
                    );
                  } catch (err) {
                    console.error("changeUserRole failed:", err);
                    alert(err instanceof Error ? err.message : "Failed to change role");
                  } finally {
                    setRowSaving((p) => ({ ...p, [user.id]: false }));
                  }
                }}
              >
                {Object.values(UserRole).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {saving && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Saving</span>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [rowSaving]
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? "").toLowerCase().trim();
      if (!q) return true;
      const email = String(row.original.email ?? "").toLowerCase();
      const name = String(row.original.name ?? "").toLowerCase();
      return email.includes(q) || name.includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600">
          {table.getFilteredRowModel().rows.length.toLocaleString()} users
        </div>
        <div className="flex items-center gap-2">
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search name or email..."
            className="h-10 w-full sm:w-80 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

