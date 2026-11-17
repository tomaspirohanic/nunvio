import { test } from "node:test";
import assert from "node:assert/strict";
import { countryConfig, monthlyPayment } from "../lib/country-config";
import { parseArea, serializeArea } from "../lib/listing-search-params";

test("mortgage annuity matches the standard formula", () => {
  assert.equal(Math.round(monthlyPayment(200000, 4, 30) * 100) / 100, 954.83);
  assert.equal(monthlyPayment(120000, 0, 10), 1000);
  assert.equal(monthlyPayment(0, 4, 30), 0);
  assert.equal(countryConfig("cz").currency, "CZK");
  assert.equal(countryConfig("XX").currency, "EUR");
});

test("drawn area survives the URL round trip and rejects junk", () => {
  const area: Array<[number, number]> = [[48.1, 17.1], [48.2, 17.2], [48.15, 17.3]];
  assert.deepEqual(parseArea(serializeArea(area)), area);
  assert.equal(parseArea("1,2;3,4"), undefined);
  assert.equal(parseArea("abc"), undefined);
  assert.equal(parseArea("91,2;3,4;5,6"), undefined);
});

test("nearby places: OpenStreetMap answer -> nearest per category", async () => {
  const { parseOverpass, summarize } = await import("../lib/nearby.server");
  const places = parseOverpass({
    elements: [
      { lat: 48.1490, lon: 17.1080, tags: { highway: "bus_stop", name: "Námestie" } },
      { lat: 48.1491, lon: 17.1081, tags: { highway: "bus_stop", name: "Námestie" } },
      { center: { lat: 48.1530, lon: 17.1100 }, tags: { amenity: "school", name: "ZŠ Mudroňova" } },
      { lat: 48.1700, lon: 17.1500, tags: { shop: "supermarket", name: "Far away" } },
      { lat: 48.1500, lon: 17.1000, tags: { leisure: "park" } },
      { lat: 48.1, lon: 17.1, tags: { amenity: "bench" } },
    ],
  });
  assert.equal(places.length, 5);
  const s = summarize(places, 48.1486, 17.1077);
  const transport = s.find((r) => r.category === "transport")!;
  assert.equal(transport.count, 1, "same-name stops count once");
  assert.equal(transport.nearest[0].name, "Námestie");
  assert.ok(transport.nearest[0].meters < 100);
  assert.equal(s.find((r) => r.category === "shop")!.count, 0, "over 1 km is left out");
  assert.equal(s.find((r) => r.category === "school")!.nearest[0].name, "ZŠ Mudroňova");
});
