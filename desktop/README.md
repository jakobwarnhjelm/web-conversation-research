# TabFlow — Spår B (Electron)

**M4.** Levande webbsidor i flödet. Varje sidblock som visar live backas av en riktig
`WebContentsView` — en fullvärdig webbläsare, inte en bild. Samma domänkärna, samma
portar och samma React-UI som `../app`; bara adaptrarna är Electron-specifika.

## Kör

Renderaren kompilerar `../app`-källkoden direkt via alias, och både TypeScript och
Vite slår upp `react` m.fl. från den importerande filens katalog. **`app/` måste
alltså ha sina beroenden installerade** — `desktop/node_modules` räcker inte.

```bash
npm --prefix ../app install
npm install
npm run dev     # Vite + Electron mot dev-servern, hot reload i UI:t
npm run build   # typecheck + renderare till dist/renderer + main/preload till dist/electron
npm start       # bygg och kör den paketerade varianten
```

`npm run dev` startar Vite på port 5174, väntar tills den svarar, kompilerar
main/preload och startar Electron mot dev-servern. Inga extra dev-beroenden behövs.

## Paketera

```bash
npm run dist:mac      # dmg + zip, arm64 och x64, i release/
npm run dist:linux    # AppImage (deb kräver fpm, alltså en Linux-maskin)
```

### macOS: "appen är skadad"

Bygget är osignerat i Apples mening — det finns inget Developer ID. På Apple-kisel
vägrar macOS starta en helt osignerad app och rapporterar den som **skadad**, vilket
låter som ett trasigt bygge men bara betyder osignerad. `build/afterPack.cjs`
ad-hoc-signerar därför appen, vilket gör den körbar.

Ad-hoc-signering ersätter inte notarisering. En **nedladdad** kopia får en
karantänflagga som Gatekeeper stoppar ändå, och då hjälper inte högerklick → Öppna
(det gäller "okänd utvecklare", inte "skadad"). Ta bort flaggan:

```bash
xattr -dr com.apple.quarantine /Applications/TabFlow.app
```

En app som byggts lokalt har ingen karantänflagga och startar direkt.

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

Varje fångst ger två artefakter, plus en tredje på begäran:

| Artefakt | Vad det är | Var | När |
|---|---|---|---|
| PNG | grafisk kopia av sidan | `imageRef` | alltid |
| Text-HTML | avskalad läsversion, ingen stil eller skript | `textHtmlRef` | alltid |
| MHTML | **hela sidan** med HTML, CSS, bilder och typsnitt i en fil | `singleFileRef` | `archive: true` |

MHTML-arkivet (F-SNAP-9) är Chromiums egen serialisering via `webContents.savePage()`
— samma idé som SingleFile, men inbyggd. Det är den enda artefakten som bevarar sidan
som den faktiskt såg ut, och just därför också den som bevarar mest av en inloggad
session. Se policyn för autentiseringsuppgifter nedan.

Artefakterna nås från remsan längst ned i ett snapshot-block: **Visa textversion**,
**Öppna arkiv (hela sidan)** när ett arkiv finns, och **Visa i Finder**. Filerna ligger i
`~/Library/Application Support/TabFlow/tabflow/blobs`.

### Fånga alla (F-SNAPWF)

`SnapshotService` i `app/src/ports/index.ts` fångar en URL **utan** monterat block —
nödvändigt eftersom flödet är virtualiserat och handtag bara finns för det som är i vy.
`IpcSnapshotService` implementerar den; `CaptureAllPanel` kör två arbetare mot den, och
`withCaptureSlot` i `electron/capture.ts` håller samma tak i main så att en lång
anteckning inte startar ett dolt fönster per sida samtidigt.

## Säkerhet (avsnitt 9)

Främmande innehåll kör i en egen persistent session (`persist:tabflow-guest`) med
`contextIsolation`, `sandbox` och utan `nodeIntegration`. **Ingen preload är kopplad till
gästvyer**, så en inbäddad sida kan aldrig nå `window.tabflow`. Popup-försök nekas och
skickas till systemets webbläsare — även från det dolda fönster fångsten använder. UA:n
städas från "Electron" så sidor inte serverar "webbläsaren stöds inte".

`hardenGuestSession()` i `electron/guest.ts` **nekar alla behörighetsförfrågningar**.
Utan den beviljar Electron det mesta som en sida ber om, och en anteckningsbok behöver
varken kamera, mikrofon, position, notiser eller urklipp — allra minst i en vy
användaren inte tittar på.

Renderaren laddar dev-servern endast när `!app.isPackaged`. Den bär hela bryggan, så en
miljövariabel får inte kunna styra in fjärrkod i den i ett installerat bygge.

## Autentiseringsuppgifter — policyn

**Appen rör aldrig ett lösenord.** Electron har ingen lösenordshanterare; Chromes är en
del av Chrome, inte av rendermotorn. En `WebContentsView` får därför varken spara-fråga
eller autofyll, och det ska den inte få. All inloggning sker mellan användaren och
sajten, och det som blir kvar är sajtens egen kaka i gästsessionen — krypterad av
Chromium mot OS-nyckelringen.

Två konsekvenser att känna till:

- **macOS:** nyckelringens åtkomst är bunden till kodsignaturen, och vår ad-hoc-signatur
  ändras vid varje bygge. Användare kan därför få nyckelringsdialoger eller bli utloggade
  efter en uppdatering. Det försvinner först med ett riktigt Developer ID.
- **Linux:** utan gnome-keyring eller kwallet faller Chromium tillbaka på en hårdkodad
  nyckel, och kakorna är i praktiken oskyddade.

Ska appen någonsin lagra en egen hemlighet — en API-nyckel, en synk-token — är svaret
`safeStorage.encryptString`, aldrig en fil i klartext.

Fångat innehåll är den verkliga exponeringen, inte lösenordsfälten. Textextraktionen
kastar `form`, `input` och `textarea`, men bilden visar allt som syns och **MHTML-arkivet
bevarar hela den inloggade DOM:en** med dolda fält och inbäddad JSON om användaren.
Därför är arkivet opt-in (`CaptureOptions.archive`), och därför skrivs allt fångat med
`0600` i kataloger med `0700` — se `FILE_MODE` och `DIR_MODE` i `electron/storage.ts`.

`clearGuestSession()` rensar kakor, lagring och cache. Utan den vägen skulle appen tyst
samla på sig sessioner för varje sajt användaren tittat på, utan att ens nämna det.

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
