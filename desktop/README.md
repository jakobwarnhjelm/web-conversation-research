# TabFlow — Spår B (Electron)

**M4.** Levande webbsidor i flödet. Varje sidblock som visar live backas av en riktig
`WebContentsView` — en fullvärdig webbläsare, inte en bild. Samma domänkärna, samma
portar och samma React-UI som `../app`; bara adaptrarna är Electron-specifika.

## Kör

```bash
npm install
npm run dev     # Vite + Electron mot dev-servern, hot reload i UI:t
npm run build   # typecheck + renderare till dist/renderer + main/preload till dist/electron
npm start       # bygg och kör den paketerade varianten
```

`npm run dev` startar Vite på port 5174, väntar tills den svarar, kompilerar
main/preload och startar Electron mot dev-servern. Inga extra dev-beroenden behövs.

## Arkitektur — bara adaptrar skiljer

| Port | Spår B-adapter | Fil |
|---|---|---|
| `SidblockRenderer` | `WebviewRenderer` (levande `WebContentsView` per block) | `src/adapters/WebviewRenderer.ts` |
| `BlobStore` | `IpcBlobStore` → filsystem under `userData/tabflow/blobs` | `src/adapters/IpcBlobStore.ts` |
| `DocumentStore` | `IpcDocumentStore` → JSON under `userData/tabflow/documents` | `src/adapters/IpcDocumentStore.ts` |
| `TabController` | `ShellTabController` (`shell.openExternal`) | `src/adapters/ShellTabController.ts` |

Renderaren når main enbart genom `window.tabflow` (`electron/preload.ts`). Ingen
`nodeIntegration`, ingen Electron-modul i renderaren.

## Arbetsfördelningen som Spike E1 avgjorde

Renderaren äger scroll, virtualisering och layout. Main-processen äger de native
vyerna. Två fynd från spiken är inbyggda:

1. **En `WebContentsView` klipps inte av en scroll-container.** Renderaren skickar
   därför en *färdigklippt* rektangel. Porten fick `SidblockHost.getClipRect()` för
   ändamålet, och `PageBlockView` fyller den från närmaste scrollande förälder.
2. **Inget DOM kan ritas ovanpå vyn.** All chrome ligger i blockhuvudet ovanför
   innehållsytan, och DOM-containern hålls tom så länge blocket visar live.

`WebviewRenderer` skickar **ett** `views:sync`-anrop per frame för *alla* block, inte
ett per block. Scroll producerar frames snabbare än IPC svarar, så anropen serialiseras
och den senaste layouten vinner istället för att gamla frames köar upp.

## Livscykel (F-LAZY / F-PERF)

- **Tak: 3 samtidigt levande vyer** (`LIVE_CAP` i `electron/views.ts`). Äldst oanvänd
  avlastas först och dess guest-process frigörs på riktigt med `webContents.close()`.
- **Avmonterat block → dispose.** Virtualiseraren monterar bara det som är nära vy;
  main disposar allt renderaren inte längre skickar.
- **Monterat men utanför vy → dölj, inte dispose.** Att slänga vyn vid varje kantpassage
  skulle ladda om sidan i onödan.

## Snapshot (F-SNAP-1) — och varför dödsstöt 2 inte finns här

Två vägar, och `fullPage`-flaggan är ärlig om vilken som användes:

- **Blocket är live** → fånga vyn användaren tittar på. `fullPage: false`.
- **Ingen levande vy** → ladda URL:en i ett dolt fönster som storleksändras till hela
  dokumenthöjden (tak 8000 px) och fånga där. `fullPage: true` — alltså F-SNAP-8.

Ingen flik behöver bli aktiv, inget flimmer, ingen host-behörighet. Det som blockerar
batch-snapshot i Spår A är helt enkelt inte ett problem i Electron, vilket gör
F-SNAPWF byggbart här utan ny spike.

Varje fångst ger **tre** artefakter:

| Artefakt | Vad det är | Var |
|---|---|---|
| PNG | grafisk kopia av sidan | `imageRef` |
| Text-HTML | avskalad läsversion, ingen stil eller skript | `textHtmlRef` |
| MHTML | **hela sidan** med HTML, CSS, bilder och typsnitt i en fil | `singleFileRef` |

MHTML-arkivet (F-SNAP-9) är Chromiums egen serialisering via `webContents.savePage()`
— samma idé som SingleFile, men inbyggd. Det är den enda artefakten som bevarar sidan
som den faktiskt såg ut; text-HTML:en är läsbar men avskalad.

Alla tre nås från remsan längst ned i ett snapshot-block: **Visa textversion**,
**Öppna arkiv (hela sidan)** och **Visa i Finder**. Filerna ligger i
`~/Library/Application Support/@tabflow/desktop/tabflow/blobs`.

## Säkerhet (avsnitt 9)

Främmande innehåll kör i en egen persistent session (`persist:tabflow-guest`) med
`contextIsolation`, `sandbox` och utan `nodeIntegration`. Popup-försök nekas och
skickas till systemets webbläsare. UA:n städas från "Electron" så sidor inte serverar
"webbläsaren stöds inte".

## Verifierat

Kört mot en ren lagring och driven över CDP:

- 6 sidblock, **max 3 samtidigt levande**, 6 distinkta vyer skapade under en
  scrollgenomgång — taket hålls och dispose sker (11 LRU-avlastningar i loggen).
- Snapshot gav 2 blobbar (PNG 1712×960 av den levande Google-vyn + text-HTML med
  riktigt extraherat innehåll), badge växlade till `SNAPSHOT` med tidsstämpel.
- Live/snapshot-växeln tar tillbaka den native vyn.
- Inga fel i renderaren.

## Inte i M4 (nästa)

Batch-"Snapshot: alla" (F-SNAPWF), dokumentlista för flera dokument (F-DOK-3), sök
(F-NAV), export/import-UI, drag-and-drop.

**Öppen fråga som kräver din maskin:** subjektiv scroll-fps (F-PERF-1) med flera tunga
sajter samtidigt. Det gick inte att döma programmatiskt — scrolla snabbt och känn efter.
