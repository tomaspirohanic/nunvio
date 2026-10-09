// ============================================
// PROPERTY NOT FOUND PAGE
// ============================================
// 404 page for non-existent properties
// ============================================

import Link from "next/link";

export default function PropertyNotFound() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Property Not Found
      </h1>
      <p className="text-gray-600 mb-8">
        The property you're looking for doesn't exist or has been removed.
      </p>
      <Link
        href="/properties"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Browse All Properties
      </Link>
    </div>
  );
}
