// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeXmlProperties,
  parseXmlProperties,
  validateXmlFeedContent,
} from "../lib/import-xml";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

test("Sreality-style export: codebooks, generated title, bad record skipped", () => {
  const raw = parseXmlProperties(fixture("sreality-export.xml"));
  assert.equal(raw.length, 3);
  const { properties, failed, errors } = normalizeXmlProperties(raw, { defaultCountry: "Czech Republic" });
  assert.equal(failed, 1);
  assert.match(errors[0], /#3/);
  const [flat, house] = properties;
  assert.equal(flat.externalId, "RK-2001");
  assert.equal(flat.offerType, "SALE");
  assert.equal(flat.propertyType, "APARTMENT");
  assert.equal(flat.currency, "CZK");
  assert.equal(flat.price, 6490000);
  assert.equal(flat.bedrooms, 2);
  assert.equal(flat.areaSqm, 54);
  assert.equal(flat.isNewBuild, true);
  assert.equal(flat.title, "Prodej bytu 2+kk 54 m², Praha – Karlín");
  assert.equal(flat.address, "Křižíkova 12, Karlín, Praha");
  assert.deepEqual(flat.imageUrls, ["https://cdn.example.com/a1.jpg", "https://cdn.example.com/a2.jpg"]);
  assert.equal(house.offerType, "RENT");
  assert.equal(house.propertyType, "HOUSE");
  assert.equal(house.currency, "EUR");
  assert.equal(house.country, "Slovakia");
  assert.equal(house.bedrooms, 4);
  assert.equal(house.title, "Prenájom domu 4-izb. 140 m², Senec");
});

test("OpenImmo (DE/AT)", () => {
  const raw = parseXmlProperties(fixture("openimmo.xml"));
  assert.equal(raw.length, 1);
  const { properties, failed } = normalizeXmlProperties(raw);
  assert.equal(failed, 0);
  const p = properties[0];
  assert.equal(p.externalId, "W-77");
  assert.equal(p.title, "Helle 3-Zimmer-Wohnung im 7. Bezirk");
  assert.equal(p.country, "Austria");
  assert.equal(p.city, "Wien");
  assert.equal(p.price, 389000);
  assert.equal(p.propertyType, "APARTMENT");
  assert.equal(p.offerType, "SALE");
  assert.equal(p.areaSqm, 72);
  assert.equal(p.bedrooms, 3);
  assert.equal(p.isNewBuild, true);
  assert.equal(p.latitude, 48.2005);
  assert.match(p.description, /Balkon[\s\S]*U3/);
  assert.deepEqual(p.imageUrls, ["https://img.example.at/1.jpg", "https://img.example.at/2.jpg"]);
  assert.equal(p.address, "Neubaugasse 5, 1070 Wien");
});

test("Kyero v3", () => {
  const raw = parseXmlProperties(fixture("kyero.xml"));
  assert.equal(raw.length, 1);
  const { properties, failed } = normalizeXmlProperties(raw);
  assert.equal(failed, 0);
  const p = properties[0];
  assert.equal(p.externalId, "MAR-55");
  assert.equal(p.country, "Spain");
  assert.equal(p.propertyType, "HOUSE");
  assert.equal(p.description, "Villa with pool and sea views.");
  assert.equal(p.title, "3-bed house for sale, 180 m², Marbella");
  assert.equal(p.bathrooms, 2);
  assert.deepEqual(p.imageUrls, ["https://kyero.example.com/1.jpg", "https://kyero.example.com/2.jpg"]);
});

test("Nunvio canonical format still works and is detected", () => {
  const r = validateXmlFeedContent(fixture("nunvio.xml"));
  assert.ok(r.total > 0);
  assert.equal(r.sampleFailed, 0, r.errors.join("; "));
  assert.deepEqual(r.formats, ["nunvio"]);
});
