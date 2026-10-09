// Resolves gallery URLs: prefer ordered PropertyImage rows, fall back to legacy string[].
// Deduplicate by URL so accidental double-saves don't show twice in the UI.
export function resolvePropertyImageUrls(property: {
  images?: string[] | null;
  propertyImages?: { url: string; order?: number }[] | null;
}): string[] {
  const fromDb =
    property.propertyImages
      ?.slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((img) => img.url)
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0) ??
    [];

  const source =
    fromDb.length > 0
      ? fromDb
      : (property.images ?? []).filter(
          (url): url is string => typeof url === "string" && url.trim().length > 0
        );

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of source) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}
