import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/admin-auth";
import { resolvePropertyImageUrls } from "@/lib/property-gallery";

export default async function AdminPropertiesPage() {
  await requireSuperadmin();

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      city: true,
      country: true,
      price: true,
      currency: true,
      offerType: true,
      propertyType: true,
      promotionLevel: true,
      createdAt: true,
      images: true,
      propertyImages: {
        orderBy: { order: "asc" },
        select: { url: true, order: true },
        take: 1,
      },
      agency: { select: { id: true, name: true } },
      owner: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows = properties.map((p) => ({
    ...p,
    price: Number(p.price),
    cover: resolvePropertyImageUrls(p)[0] ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          Properties
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Latest {rows.length} listings across the platform (max 200).
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Listing
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Offer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Price
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Agency / Owner
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Promo
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No properties yet.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {p.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">
                            {p.title}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {p.city}, {p.country} · {p.propertyType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.offerType}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.price.toLocaleString()} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.agency ? (
                        <Link
                          href={`/sk/agencies/${p.agency.id}`}
                          className="text-blue-600 hover:underline"
                          target="_blank"
                        >
                          {p.agency.name}
                        </Link>
                      ) : (
                        <span className="text-gray-500">
                          {p.owner.name || p.owner.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {p.promotionLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/sk/properties/${p.id}`}
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
