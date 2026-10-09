export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <div className="h-5 w-3/4 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="h-4 w-full bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-200 rounded mb-4 animate-pulse" />
            <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
  