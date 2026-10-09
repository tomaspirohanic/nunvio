import { Link } from "@/src/i18n/routing";

export default function AgencyNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-950">Agentúra nenájdená</h1>
      <p className="mt-2 text-sm text-gray-500">
        Táto realitná kancelária neexistuje alebo bola odstránená.
      </p>
      <Link
        href="/properties"
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Späť na nehnuteľnosti
      </Link>
    </div>
  );
}
