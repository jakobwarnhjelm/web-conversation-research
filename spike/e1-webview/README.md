# Spike E1 — WebContentsView i ett virtualiserat scrollflöde

> **Engångskod.** Målet är lärande, inte produktion. Läs `FYND` nedan innan du dömer koden.

Detta validerar **dödsstöt 1** i TabFlow-specen (avsnitt 12.1: antagandet att
virtualiseringen "fungerar identiskt i båda spåren"). Frågan:

> Kan flera **live** `WebContentsView` samexistera med ett **virtualiserat** scrollflöde —
> positioneras rätt vid scroll, disposas när de lämnar vy, hålla ett tak med LRU, och
> kan **DOM-chrome (verktygsrad/infogningszon) ligga ovanpå dem**?

## Kör lokalt

```bash
cd spike/e1-webview
npm install
npm start
```

Scrolla. Sidblocken (var tredje block) är levande `WebContentsView`. Byt `livePage(...)`
i `renderer.js` mot riktiga `https://`-URL:er om du vill se riktiga sidor (kräver nät).

Headless (ingen skärm), för att bevisa mekaniken utan att titta:

```bash
SPIKE_SMOKE=1 npm run start:xvfb   # scrollar igenom, loggar live-antal + cap/dispose-verdikt
SPIKE_SHOT=1  npm run start:xvfb   # sparar spike-shot.png (hela skärmen, inkl. native-lager)
```

## Vad du ska titta efter (checklista)

| # | Att verifiera | Förväntat |
|---|---|---|
| 1 | Sidblocken följer scrollen utan att släpa/tåra | bör stämma; **fps-känslan avgör du på din maskin** |
| 2 | HUD (uppe till höger): `live` överstiger aldrig 3 | tak hålls (LRU) |
| 3 | Långt bortscrollade block frigör processer (`processer:` i HUD sjunker) | dispose sker |
| 4 | **Den rosa verktygsraden syns ovanpå ett sidblock** | ❌ **den göms bakom vyn** — se FYND |
| 5 | Block-huvudet (titelraden) syns ovanför vyn | ✅ funkar (ligger utanför vyns rect) |

## FYND (utfall)

**Bilden `spike-shot.png` är beviset.** Vid scrollTop=900, blk_p2 i vy:

- ✅ **Bounds-synk fungerar.** Den native vyn placeras exakt i sitt blocks slot utifrån
  `getBoundingClientRect()` → `WebContentsView.setBounds()`. Ingen synlig tearing statiskt.
- ✅ **Klippning under header fungerar** — men **manuellt** (`clip()` i `main.js`). Native
  vyer klipper INTE mot en scroll-container av sig själva; vi måste räkna ut den synliga
  delen själva. Dokumenterad kostnad.
- ✅ **Dispose / LRU / tak fungerar.** `SPIKE_SMOKE`-körning: **9 distinkta vyer skapades,
  aldrig fler än 2 samtidigt live, taket (3) hölls, processantalet steg/sjönk med skapa/dispose.**
  Guest-processen frigörs på riktigt (`webContents.close()`), inte bara döljs (F-LAZY-5 ✔).
- ❌ **DOM-överlägg ovanpå en `WebContentsView` är OMÖJLIGT.** Den rosa verktygsraden har
  `z-index: 9999` men **göms helt** bakom den native vyn. `WebContentsView` är ett separat
  native-lager som komponeras *ovanpå* fönstrets HTML — inget DOM-element kan ritas över den.
  Detta träffar direkt **F-BLK-6** (block-verktygsrad) och **F-UX-3** ("+"-infogningszon över block).

## Konsekvens för arkitekturen (det spiken avgör)

`WebContentsView` behålls (robust, modern, per-vy dispose = precis vad F-LAZY-4/5 kräver),
**men UI:t måste följa en regel:**

> **All interaktiv DOM-chrome lever i reserverade remsor som ligger *utanför* den native
> vyns rect — aldrig flytande ovanpå den.**

Konkret för TabFlow:
- **Block-verktygsrad, drag-handtag, favicon/titel, live/snapshot-växel** → i ett **block-huvud**
  (DOM-rad ovanför webbytan). Bevisat fungerande i bilden.
- **"+"-infogningszon (F-UX-3)** → i **gapet mellan block** (DOM, utanför alla vyer).
- **Overlays som *måste* täcka innehåll** (modaler, drag-förhandsvisning, urvals-kryssrutor för
  batch-snapshot **F-SNAPWF-3**) → gå in i ett läge där live-vyerna **byts mot sina snapshot-bilder**
  (DOM) eller flyttas offscreen. Här faller **F-SNAPWF-8** (block har både live *och* snapshot)
  naturligt på plats: "gå in i urvals-/dragläge → visa snapshot-bild istället för live".

### Portkonsekvens (`SidblockRenderer`, avsnitt 6.2)
- I Spår B returnerar `render()` **en handle till en native vy vars bounds drivs externt** av
  FlowView — renderaren äger *inte* ett DOM-element som virtualiseraren klipper in/ut.
- FlowView virtualiserar **spacer-divar + block-huvuden** och synkar native-vyernas bounds mot dem.
- `SidblockHandle.setDisplay("snapshot"|"live")` är inte bara kosmetik — det är mekanismen som gör
  overlay-lägen (urval/drag/modal) möjliga trots native-lagret.

## Ej avgjort här (kräver din maskin / senare)
- **Subjektiv scroll-fps (≥50, F-PERF-1)** vid många vyer — går inte att döma headless. Kör `npm start`
  och scrolla snabbt. Misstänkt riskpunkt: `setBounds` per frame för flera vyer.
- Beteende med **riktiga tunga sajter** (nät, cookie-banners) i vyerna.
- **Partiell klippning vid snabb momentum-scroll** (native-vyn kan "hoppa" en frame efter DOM).
