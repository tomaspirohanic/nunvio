# Partner outreach — SK / CZ CRM & agencies

Use these templates when contacting multi-posting / CRM vendors and agencies.
Production partner page: `/partners` (localized). Validate API: `POST /api/partners/validate-feed`.

## Target list

### Slovakia (CRM / multi-post)
| Company | Role | First ask |
| --- | --- | --- |
| backOFFICE / ZRKS | CRM + open API | Add Nunvio as export destination |
| RealSys | Multi-post SK/CZ+ | Connector / feed to Nunvio |
| easyReal.NET | CRM + many exports | Export bridge |

### Czech Republic
| Company | Role | First ask |
| --- | --- | --- |
| Softreal | CRM + export bridges | New exportný můstek → Nunvio |
| Urbium | Large RK base | Export na Nunvio |
| REALBrána (eBRÁNA) | CRM | Export |
| Poski REAL | CRM | Export |

### Direct agencies
Any RK with a public HTTPS XML (or willing to host one). They register as agency on Nunvio, paste feed URL, enable sync.

---

## Email — CRM vendor (SK)

**Predmet:** Žiadosť o exportný mostík na Nunvio (nový EU realitný portál)

Dobrý deň,

volám sa [MENO], prevádzkujem portál **Nunvio** (https://nunvio.vercel.app) — európsky realitný katalóg so štartom na SK/CZ a postupným rozširovaním do EÚ.

Prosím o doplnenie **exportu / mostíka** na Nunvio pre vašich klientov (realitné kancelárie).

**Technické podklady (všetko hotové na našej strane):**
- Špecifikácia XML: https://nunvio.vercel.app/sk/partners  
- Ukážka: https://nunvio.vercel.app/samples/nunvio-properties-sample.xml  
- Validácia feedu: `POST https://nunvio.vercel.app/api/partners/validate-feed` s JSON `{ "feedUrl": "…" }`  
- Sync beží automaticky po dávkach (vhodné aj pre tisíce inzerátov)  
- Upsert podľa `externalId` (bez duplicít)

Inzercia na Nunvio je pre agentúry na začiatku **bezplatná** (chceme zásobu inzerátov + kvalitné leady). Radi poskytneme testovací účet agentúry a podporu pri mapovaní polí.

Ďakujem a teším sa na spoluprácu,  
[MENO]  
[TELEFÓN]  
[E-MAIL]

---

## Email — CRM vendor (CZ)

**Předmět:** Žádost o exportní můstek na Nunvio (nový realitní portál EU)

Dobrý den,

provozuji portál **Nunvio** (start CZ/SK, dále EU). Prosím o přidání exportu nabídek na Nunvio pro vaše klienty.

Dokumentace a sample XML: https://nunvio.vercel.app/cs/partners  
Validace: `POST /api/partners/validate-feed`  
Automatická synchronizace po dávkách, upsert podle `externalId`.

Inzerce na Nunvio je pro RK na začátku zdarma. Rád připravím testovací účet.

S pozdravem,  
[JMÉNO]

---

## Email — realitná kancelária (SK)

**Predmet:** Bezplatný XML import vašich ponúk na Nunvio

Dobrý deň,

Nunvio je nový realitný portál pre SK/CZ (a neskôr EÚ). Ak máte XML export z CRM (alebo web), vieme vaše ponuky **automaticky synchronizovať** — bez manuálneho prepisovania.

1. Registrácia agentúry na Nunvio  
2. Dashboard → XML import → vložiť Feed URL → zapnúť sync  
3. Hotovo (aktualizácie bežia na pozadí)

Špecifikácia: https://nunvio.vercel.app/sk/partners  

Ak používate Softreal / Urbium / backOFFICE / RealSys, vieme s nimi dohodnúť priamy mostík.

S pozdravom,  
[MENO]

---

## Checklist pred prvým callom
- [ ] Produkcia má `CRON_SECRET` + Vercel cron
- [ ] `/partners` funguje
- [ ] Sample XML otvárateľný
- [ ] `validate-feed` otestovaný na sample
- [ ] Máte demo agency účet pripravený
- [ ] PARTNER_CONTACT_EMAIL nastavený
