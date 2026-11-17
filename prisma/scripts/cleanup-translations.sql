-- One-time cleanup after deploying the "no translation at render time" change.
-- Run once in the Neon SQL editor (production branch).
--
-- 1) Fake translations that older code saved when DEEPL_API_KEY was missing
--    (e.g. "[Translated to de] Kras...", "[es] Villa de lujo con piscina").
DELETE FROM "PropertyTranslation"
WHERE title LIKE '[Translated to %'
   OR title LIKE '[es] %' OR title LIKE '[cs] %'
   OR description LIKE '[Translated to %'
   OR description LIKE '[es] %' OR description LIKE '[cs] %';

-- 2) "EN translations" that are just a copy of the original text (old create /
--    import code). They block the background job from producing a real
--    English translation. The original text is still shown meanwhile.
DELETE FROM "PropertyTranslation" t
USING "Property" p
WHERE t."propertyId" = p.id
  AND t.title = p.title
  AND t.description = p.description;
