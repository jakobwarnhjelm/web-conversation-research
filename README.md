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
| M2 Spår A / M3 / M4 Spår B / M5 | ⏭ Planerat | — |

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

## Kör allt

```bash
cd domain && npm install && npm test        # 22 tester
cd ../app && npm install && npm run dev      # http://localhost:5173
```

## Nästa steg

1. ~~Frys porten~~ ✅ · ~~M1 UI-skal~~ ✅
2. **M2 Spår A:** `ChromeSnapshotRenderer` (bild via `captureVisibleTab` + text-HTML via
   läsbarhetsextraktion) bakom samma port + IndexedDB-blobstore → publicerbar Chrome-MVP.
3. Dokumentlista/flera dokument (F-DOK-3), export/import-UI, sök (F-NAV).

Öppen framtida risk (dödsstöt 2, ej spikad än): batch-"Snapshot: alla" över lagrade URL:er i
Spår A är ett flik-orkestreringsflöde, inte en capture. Spikas före M3/F-SNAPWF.
