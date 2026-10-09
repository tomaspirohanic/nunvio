# Nunvio partner XML feed

Agencies and multi-posting / CRM partners publish listings to Nunvio via a public **HTTPS XML feed**. Nunvio pulls the feed on a schedule (~every 15 minutes) in **chunks**, so catalogs of tens of thousands of listings stay within serverless time limits.

**Public page:** `/partners`  
**Outreach emails:** `docs/PARTNER-OUTREACH.md`  
**Validate (no DB write):** `POST /api/partners/validate-feed`  
Body: `{ "feedUrl": "https://…/export.xml" }` or `{ "xml": "<properties>…" }`

## Onboarding paths

### A) CRM / multi-posting vendor (Softreal, Urbium, backOFFICE, RealSys, …)
1. Map your export fields to Nunvio (canonical English tags **or** SK/CZ aliases below).
2. Expose a stable HTTPS URL per agency (or one feed with stable `externalId`s).
3. Agency creates a Nunvio account → Dashboard → XML import → paste URL → enable sync.
4. Optional: call validate-feed before go-live.

### B) Direct agency
Same as step 3–4. Host XML on their website / CDN / CRM export URL.

## Canonical XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<properties>
  <property>
    <externalId>CRM-1001</externalId>
    <title>Listing title</title>
    <description>Full description…</description>
    <price>250000</price>
    <currency>EUR</currency>
    <offerType>sale</offerType>
    <city>Bratislava</city>
    <country>Slovakia</country>
    <propertyType>APARTMENT</propertyType>
    <bedrooms>3</bedrooms>
    <bathrooms>1</bathrooms>
    <areaSqm>78</areaSqm>
    <latitude>48.1486</latitude>
    <longitude>17.1077</longitude>
    <images>
      <image>https://cdn.example.com/1.jpg</image>
    </images>
  </property>
</properties>
```

Sample: `/samples/nunvio-properties-sample.xml`

## Accepted roots / item tags

| Wrapper | Item node |
| --- | --- |
| `properties`, `reality`, `offers`, `nemovitosti`, `adverts`, `listings`, `data`, `export` | `property`, `advert`, `offer`, `item`, `nemovitost`, `inzerat`, `listing` |

## Field aliases (SK / CZ CRM friendly)

| Nunvio | Also accepted |
| --- | --- |
| `externalId` | `id`, `code`, `kod`, `ref`, `cislo`, `zakazka` |
| `title` | `nazov`, `nazev`, `name`, `nadpis` |
| `description` | `popis`, `text`, `content` |
| `price` | `cena`, `castka` |
| `currency` | `mena` (`KČ` → CZK) |
| `city` | `mesto`, `obec`, `lokalita` |
| `country` | `krajina`, `stat`, `SK`/`CZ`/`AT`/`PL`/`HU`/`DE` |
| `offerType` | `offer`, `prenajom` / `pronájem` → rent |
| `propertyType` | `type`, `typ`, `druh` (+ byt/dom/pozemok/…) |
| `bedrooms` | `rooms`, `izby`, `dispozice`, `pocet_izieb` |
| `areaSqm` | `plocha`, `vymera`, `m2`, `uzitkova_plocha` |
| `latitude` / `longitude` | `lat` / `lon` / `lng` / `gps_*` |
| images | `images`/`image`, `fotky`/`foto`, `photos`/`photo`, `galerie` |

If `country` is missing, Nunvio falls back to the **agency profile country**.

### Required
`title`, `description`, `price`, `city`, `country` (or agency default).  
**`externalId` strongly required** for feeds (upsert key).

### Enums
- `currency`: EUR, USD, GBP, CZK  
- `offerType`: sale / rent  
- `propertyType`: HOUSE, APARTMENT, LAND, COMMERCIAL  

## Sync behaviour
- Cron: `GET /api/cron/sync-feeds` + `Authorization: Bearer $CRON_SECRET`
- Chunked import; `feedOffset` advances until end, then resets
- Max XML size: **40 MB**
- Images downloaded to R2 (capped per listing)

## International rollout
Start SK + CZ feeds. Same XML works for AT/PL/HU/DE — set `country` (or ISO) per listing. No separate schema per country.

## Commercial note for partners
Listing ingest is free for agencies at launch. Paid features (promotions, later agency packages) are optional upsell — CRM vendors are not charged for adding an export bridge.
