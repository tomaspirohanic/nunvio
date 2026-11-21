// Place list behind the "Kde:" box (lib/places).
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchPlaces, citiesForArea, findPlaceByValue } from "../lib/places";

const names = (q: string) => searchPlaces(q).map((p) => p.name);

test("suggests towns without listings, ignoring case and diacritics", () => {
  assert.deepEqual(names("sobra"), ["Sobrance", "okres Sobrance"]);
  assert.equal(names("zilina")[0], "Žilina");
  assert.equal(names("KOŠICE")[0], "Košice");
  assert.equal(names("bratis")[0], "Bratislava");
});

test("finds city parts, districts, regions and later words of a name", () => {
  const petrzalka = searchPlaces("petrž")[0];
  assert.equal(petrzalka.name, "Petržalka");
  assert.deepEqual(petrzalka.context, ["Bratislava", "Bratislavský kraj"]);
  assert.equal(searchPlaces("okres sobr")[0].name, "Sobrance");
  assert.ok(names("bystrica").includes("Banská Bystrica"));
  assert.ok(names("košický").includes("Košický kraj"));
});

test("covers all of Slovakia", () => {
  for (const q of ["Lopúchov", "Mníšek nad Popradom", "Sečovská Polianka", "Abrahám", "Zemplínska Teplica"]) {
    assert.equal(findPlaceByValue(q)?.name, q, q);
  }
});

test("districts and regions stand for their towns in a search", () => {
  const sobrance = citiesForArea("okres Sobrance")!;
  assert.ok(sobrance.includes("Sobrance") && sobrance.includes("Beňatina"));
  assert.ok(!sobrance.includes("Michalovce"));
  assert.ok(citiesForArea("Košický kraj")!.includes("Košice"));
  assert.ok(citiesForArea("okres Bratislava V")!.includes("Petržalka"));
  assert.equal(citiesForArea("Sobrance"), null);
  assert.equal(citiesForArea("niečo iné"), null);
});
