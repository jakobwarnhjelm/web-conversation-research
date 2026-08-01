# TabFlow

Scroll-baserad "tab-notebook" — beskrivande text varvad med fönster av webbsidor i ett
vertikalt flöde. Se kravspec v1.1.

Detta repo är i **riskupptäckts-/spikefasen** (mindcamp-project-spike). Ingen produktions-UI
är byggd ännu — vi validerar det farligaste antagandet först.

## Status

| Del | Läge | Var |
|---|---|---|
| **Spike E1** — WebContentsView × virtualisering (dödsstöt 1) | ✅ Kört, slutsats dragen | [`spike/e1-webview/`](spike/e1-webview/README.md) |
| **M0** — spårsagnostisk domänkärna | ✅ 22 tester gröna, typecheck ren | [`domain/`](domain/) |
| **Portar** `SidblockRenderer` m.fl. | ✅ Frysta, informerade av spiken | [`app/src/ports/`](app/src/ports/index.ts) |
| **M1** — UI-skal: virtualiserat flöde, textblock, blockoperationer, mock-snapshot | ✅ Bygger rent, renderar (skärmbild) | [`app/`](app/README.md) |
| **M2 Spår A** — Chrome MV3-tillägg: fångst, dubbel artefakt, IndexedDB | ✅ Bygger rent; capture testas manuellt i Chrome | [`extension/`](extension/README.md) |
| **Text-HTML-extraktion** (F-SNAP-3) + IndexedDB-blobstore | ✅ 15 tester gröna | [`app/src/lib/`](app/src/lib/extractReadable.ts) |
| **M4 Spår B** — Electron: levande `WebContentsView` per block, LRU, fångst till fil | ✅ Verifierad körning (tak hålls, dispose sker, dubbel artefakt) | [`desktop/`](desktop/README.md) |
| M3 / M5 | ⏭ Planerat | — |

## Spike E1 — resultat i en mening

Live `WebContentsView` kan positioneras, disposas och LRU-takas i ett virtualiserat flöde —
**men DOM-chrome kan inte ligga ovanpå en native vy.** Följd: all interaktiv chrome (verktygsrad,
"+"-zon, urvals-kryssrutor) måste ligga i remsor *utanför* vyns rect, eller så byts live-vyn mot
sin snapshot-bild i overlay-lägen. Detaljer + bevisbild: `spike/e1-webview/README.md`.

## M0 — domänkärna

Ren TypeScript, inget UI-/spårberoende (avsnitt 5–6 i specen): datamodell, block-kommandon
(add/move/remove/insert/duplicate/collapse/höjd/etikett/snapshot/live-växel), serialisering +
migrering.

```bash
cd domain
npm install
npm test        # 22 tester
npm run typecheck
```

## Webbdemo — att dela med andra

`app/` bygger till **en enda HTML-fil** utan server, konto eller inloggning. Dokumentet
ligger i localStorage och bilder i IndexedDB, så allt stannar i besökarens webbläsare.

```bash
cd app && npm run build:single    # dist/tabflow-single.html — öppna eller lägg var som helst
```

Begränsningen är ärlig och oundviklig: en webbläsare får inte bädda in främmande sidor,
så sidblock visas som länkkort och 📷 sparar en platshållarkopia. Levande sidor finns
bara i Electron-versionen.

## Textvyn — notebooken som råtext

Knappen **Text** i huvudet visar hela dokumentet som markdown-snuttar varvat med
URL-rader. En rad som bara innehåller en URL blir ett sidblock; allt annat blir text.
Sidblock återanvänds per URL vid sparning, så snapshots överlever en omskrivning.
Det gör dokumentet klistrbart — skriv anteckningar och länkar var som helst och klistra
in alltihop.

## M4 — Spår B (Electron)

Den enda varianten där sidorna är **riktiga, levande webbläsarfönster**. Samma domänkärna,
portar och UI som `app/`; bara adaptrarna skiljer. Tre vyer får leva samtidigt, resten
avlastas med LRU och väcks när du scrollar tillbaka. Detaljer: [`desktop/README.md`](desktop/README.md).

```bash
cd desktop && npm install && npm run dev
```

## Kör allt

```bash
cd domain && npm install && npm test         # 22 tester
cd ../app && npm install && npm test         # 15 tester
cd ../desktop && npm install && npm run dev  # Electron-appen med levande sidor
```

## Nästa steg

1. ~~Frys porten~~ ✅ · ~~M1 UI-skal~~ ✅ · ~~M2 Spår A~~ ✅ · ~~M4 Spår B~~ ✅
2. Batch-"Snapshot: alla" (F-SNAPWF) — börja i Spår B, där mekaniken är fri från
   flik-orkestrering.
3. Dokumentlista/flera dokument (F-DOK-3), export/import-UI, sök (F-NAV).

Öppen risk **för Spår A** (dödsstöt 2, ej spikad): batch-"Snapshot: alla" över lagrade
URL:er i tillägget är ett flik-orkestreringsflöde, inte en capture. I Spår B finns den
risken inte — där fångas en URL i ett dolt fönster utan att någon flik blir aktiv.
