# TabFlow — Spår A (Chrome MV3-tillägg)

Snapshot-läge. Samma domänkärna, portar och UI som `../app`; bara adaptrarna är
Chrome-specifika. Detta är **M2 — den publicerbara MVP:n**.

## Bygg & ladda

```bash
npm install
npm run build          # tsc --noEmit + vite build → dist/
```

Sedan i Chrome:
1. `chrome://extensions` → slå på **Utvecklarläge**.
2. **Läs in okompakterat tillägg** → välj mappen `extension/dist`.
3. Klicka på TabFlow-ikonen → flow-sidan öppnas som en egen flik.
4. Gå till valfri sida → högerklick → **Lägg till i TabFlow**. Ett sidblock med
   snapshot (bild + text-HTML) läggs till i det senaste dokumentet. Öppna flow-fliken
   och se blocket; klicka "Visa textversion" för den avskalade HTML:en.

## Arkitektur — bara adaptrar skiljer

| Port | Spår A-adapter | Fil |
|---|---|---|
| `SidblockRenderer` | `ChromeSnapshotRenderer` (visar lagrad bild, "Visa textversion", 📷=förnya via SW) | `src/adapters/ChromeSnapshotRenderer.ts` |
| `BlobStore` | `IndexedDBBlobStore` (återanvänd från `../app`) | `../app/src/adapters/IndexedDBBlobStore.ts` |
| `DocumentStore` | `ChromeStorageDocumentStore` (`chrome.storage.local`) | `src/adapters/ChromeStorageDocumentStore.ts` |
| `TabController` | `ChromeTabController` (`chrome.tabs.create`) | `src/adapters/ChromeTabController.ts` |
| `TextHtmlExtractor` | injicerad `grabReadable` (self-contained, körs i sidan) | `src/injected.ts` |

Fångst-motorn är service workern (`src/sw.ts`): kontextmeny → `captureVisibleTab`
(bild) + `executeScript(grabReadable)` (text-HTML) → båda blobbar i IndexedDB →
sidblock med snapshot sparas i `chrome.storage`. Dubbel artefakt (F-SNAP-1) från start.

## Behörigheter (minimerade, 10.2)

`tabs`, `storage`, `activeTab`, `scripting`, `contextMenus`. Ingen `<all_urls>`:
`captureVisibleTab` funkar på `activeTab` som beviljas av kontextmeny-gesten (10.3 —
ingen header-manipulation, ingen iframe-injektion av främmande sidor).

## Verifierat vs behöver riktig Chrome

- ✅ **Verifierat headless:** `tsc --noEmit` + `vite build` rena. Text-HTML-extraktionen
  och IndexedDB-blobstoren har enhetstester (`../app`, 12 tester gröna). Dist-strukturen
  korrekt (manifest i roten, SW-modul importerar chunk relativt).
- ⚠️ **Behöver manuell test i Chrome:** själva fångsten (`captureVisibleTab`, `executeScript`,
  kontextmeny) går inte att köra meningsfullt headless. Ladda okompakterat enligt ovan.

## Känd gräns — dödsstöt 2 (ej spikad)

`ChromeSnapshotRenderer.snapshot()` / 📷 anropar SW:s `captureByUrl`, som öppnar URL:en i
en **ny aktiv flik**, fångar och stänger. Det flimrar och kan kräva bredare host-behörighet
än `activeTab` för programmatiskt öppnade flikar. **Batch-"Snapshot: alla" (F-SNAPWF) bygger
på samma mekanik och bör spikas innan den byggs på riktigt.** Primärvägen (kontextmeny på en
redan öppen sida) är opåverkad.

## Inte i M2 (nästa)

Full-page screenshot (F-SNAP-8), SingleFile (F-SNAP-9), sök (F-NAV), flikgrupp-import
(F-IMPORT-1, kräver `tabGroups`), export/import-UI, flera-dokument-panel.
