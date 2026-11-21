// ============================================
// BUILD THE SLOVAK PLACE LIST (lib/places/data/sk.json)
// ============================================
// Run once when the source lists change:  node scripts/build-places-sk.mjs
//
// Sources (public lists of Slovak municipalities):
//  - names, districts, regions and town/village/city-part type:
//    github.com/janci11/laravel-Slovakia-country-seeder (2 927 entries, incl.
//    the 39 city parts of Bratislava and Košice)
//  - coordinates of each municipality: github.com/m-a-k-o/slovenske-obce
//
// Output format (compact, read by lib/places/index.ts):
//  { country, regions: [name], districts: [[name, regionIdx, lat, lng]],
//    places: [[name, type, regionIdx, districtIdx, lat, lng, parent?]] }
//  type: "c" town/city, "v" village, "p" city part (parent = "Bratislava"/"Košice")
// ============================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEEDER =
  "https://raw.githubusercontent.com/janci11/laravel-Slovakia-country-seeder/main/database/seeders";
const COORDS = "https://raw.githubusercontent.com/m-a-k-o/slovenske-obce/main/obce.csv";

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

function phpRows(src) {
  const rows = [];
  const re = /array\(([^()]*)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const row = {};
    for (const kv of m[1].matchAll(/'(\w+)'\s*=>\s*(?:"([^"]*)"|'([^']*)'|(\d+))/g)) {
      row[kv[1]] = kv[2] ?? kv[3] ?? Number(kv[4]);
    }
    if (row.id) rows.push(row);
  }
  return rows;
}

const round = (n) => Math.round(n * 1e4) / 1e4;
// The two lists spell double names differently ("Kočín - Lančár" / "Kočín-Lančár").
const fold = (s) => s.replace(/\s*-\s*/g, "-").toLowerCase();
const key = (name, district) => `${fold(name)}|${fold(district)}`;

const [regionsSrc, districtsSrc, municipalitiesSrc, coordsSrc] = await Promise.all([
  get(`${SEEDER}/RegionsTableSeeder.php`),
  get(`${SEEDER}/DistrictsTableSeeder.php`),
  get(`${SEEDER}/MunicipalitiesTableSeeder.php`),
  get(COORDS),
]);

const regionRows = phpRows(regionsSrc);
const districtRows = phpRows(districtsSrc);
const municipalityRows = phpRows(municipalitiesSrc);

const regions = regionRows.map((r) => `${r.name} kraj`);
const regionIdx = new Map(regionRows.map((r, i) => [r.id, i]));
const districtIdx = new Map(districtRows.map((d, i) => [d.id, i]));

// "name|district" -> [lat, lng]
const coords = new Map();
for (const line of coordsSrc.split(/\r?\n/)) {
  const [name, district, , lat, lng] = line.split(";");
  if (!name || !lat) continue;
  coords.set(key(name, district), [Number(lat), Number(lng)]);
  // Name-only fallback, kept only when the name is unique.
  const k = key(name, "*");
  coords.set(k, coords.has(k) ? null : [Number(lat), Number(lng)]);
}

const places = [];
const sums = districtRows.map(() => [0, 0, 0]);
const missing = [];

for (const m of municipalityRows) {
  const d = districtRows[districtIdx.get(m.district_id)];
  const di = districtIdx.get(m.district_id);
  const ri = regionIdx.get(d.region_id);
  // The source has a few names mangled by a search-and-replace of district
  // names with their ids ("Lo51" = Lopúchov, "Mníšek nad 47om" = … Popradom).
  let name = m.name.replace(/(\p{L}?)(\d+)/gu, (_, before, id) => {
    const district = districtRows[districtIdx.get(Number(id))].name;
    return before + (before && before === before.toLowerCase() ? district.toLowerCase() : district);
  });
  let parent;
  let type = m.municipality_type_id === 1 ? "c" : "v";
  if (m.municipality_type_id === 3) {
    // "Bratislava - Petržalka" -> "Petržalka", parent "Bratislava"
    [parent, name] = name.split(/\s+-\s+/);
    type = "p";
  }
  // Coordinates: city parts get their city's district centre.
  const c = coords.get(key(type === "p" ? d.name : name, d.name)) ??
    coords.get(key(type === "p" ? d.name : name, d.name.replace(/ (I|II|III|IV|V)$/, ""))) ??
    coords.get(key(name, "*"));
  if (!c) missing.push(`${name} (${d.name})`);
  const [lat, lng] = c ?? [NaN, NaN];
  if (c) {
    sums[di][0] += lat;
    sums[di][1] += lng;
    sums[di][2] += 1;
  }
  const row = [name, type, ri, di, c ? round(lat) : 0, c ? round(lng) : 0];
  if (parent) row.push(parent);
  places.push(row);
}

// Bratislava and Košice as whole cities (they span several districts).
for (const [city, regionName] of [["Bratislava", "Bratislavský kraj"], ["Košice", "Košický kraj"]]) {
  const c = coords.get(key(`${city} I`, city));
  places.push([city, "c", regions.indexOf(regionName), -1, round(c[0]), round(c[1])]);
}

const districts = districtRows.map((d, i) => {
  const [la, ln, n] = sums[i];
  return [d.name, regionIdx.get(d.region_id), n ? round(la / n) : 0, n ? round(ln / n) : 0];
});

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "places", "data", "sk.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ country: "SK", regions, districts, places }));

console.log(
  `regions ${regions.length}, districts ${districts.length}, places ${places.length}` +
    (missing.length ? `, without coordinates: ${missing.length} (${missing.slice(0, 10).join(", ")})` : "")
);
