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
