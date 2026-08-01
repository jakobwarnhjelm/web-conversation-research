# TabFlow

En anteckningsbok där webbsidor är block. Du skriver i Markdown och lägger in
webbsidor där de hör hemma — och sidorna är **riktiga, levande webbläsarfönster**
mitt i texten, inte skärmbilder. Allt ligger i ett enda vertikalt flöde som du
scrollar igenom.

Bra när du jämför saker: leverantörer, bostäder, resmål, forskningsartiklar. Din
analys och källorna du bygger den på i samma dokument.

Allt sparas lokalt på din dator. Inget konto, ingen inloggning, ingen server.

---

## Installera

Hämta senaste versionen från [Releases](https://github.com/jakobwarnhjelm/web-conversation-research/releases/latest).

| Du kör | Fil |
|---|---|
| Mac med Apple-kisel (M1–M4) | `TabFlow-<version>-mac-arm64.dmg` |
| Mac med Intel | `TabFlow-<version>-mac-x64.dmg` |
| Linux, vad som helst | `TabFlow-<version>-linux-x86_64.AppImage` |
| Debian eller Ubuntu | `TabFlow-<version>-linux-amd64.deb` |

Windows finns inte ännu.

### macOS

Öppna dmg-filen och dra över **TabFlow** till Program. Starta den sedan **en gång**
via Terminal-raden nedan:

```bash
xattr -dr com.apple.quarantine /Applications/TabFlow.app
```

Utan det säger macOS att appen är *skadad*. Den är inte skadad — den saknar Apples
notarisering, som kräver ett betalt utvecklarkonto. Meddelandet är missvisande, och
högerklick → Öppna hjälper inte just mot det. Efter kommandot startar appen som
vilken app som helst, och du behöver aldrig göra om det.

### Linux

AppImage behöver körrättighet och kan sedan ligga var som helst:

```bash
chmod +x TabFlow-<version>-linux-x86_64.AppImage
./TabFlow-<version>-linux-x86_64.AppImage
```

På Debian och Ubuntu kan du i stället installera paketet:

```bash
sudo dpkg -i TabFlow-<version>-linux-amd64.deb
```

---

## Använda

### Flödet

Dokumentet är en lodrät stapel av **block**. Ett block är antingen text eller en
webbsida. Ordningen i flödet är den enda ordningen som finns — det du ser är det
som är sparat.

Överst står dokumentets titel. Klicka i den för att byta namn.

### Skriva text

Klicka i ett textblock så blir det redigerbart. Du skriver **Markdown**: `#` för
rubriker, `**fetstil**`, punktlistor, länkar, kodblock.

- **Esc** eller **Cmd+Enter** — rendera texten igen
- Klicka utanför blocket gör samma sak

### Lägga till block

Håll muspekaren i **mellanrummet mellan två block** så dyker en rad upp med
**+ Text** och **+ Sida**. Samma två knappar finns längst ned i flödet för att
lägga till i slutet.

**+ Sida** öppnar ett fält där du skriver adressen. Du kan skriva kort —
`example.com` blir `https://example.com`.

### Webbsidor i flödet

Ett sidblock laddar sidan på riktigt. Du kan scrolla i den, klicka i den och logga
in i den, precis som i en vanlig flik.

**Tre sidor är vakna samtidigt.** Scrollar du bort från en sida somnar den för att
spara minne och batteri, och vaknar när du kommer tillbaka. Det är meningen att det
ska gå obemärkt förbi, men på en långsam uppkoppling kan du se en sida ladda om.

I blockets huvudrad finns:

| Knapp | Gör |
|---|---|
| **Liten / Medel / Stor** | hur hög sidrutan är |
| **📷** | sparar en kopia av sidan i blocket |
| **▶ / ▣** | växlar mellan levande sida och sparad kopia |
| **↗** | öppnar sidan i din vanliga webbläsare |

### Spara en kopia av en sida

**📷** fryser sidan som den ser ut just nu. Bra när innehållet kan ändras eller
försvinna — priser, annonser, artiklar.

Varje kopia innehåller tre saker, och du når dem längst ned i blocket när kopian
visas:

- **Visa textversion** — bara texten, avskalad och lättläst
- **Öppna arkiv (hela sidan)** — hela sidan med bilder och formgivning, i en fil
- **Visa i Finder** — filerna på disk, om du vill flytta eller skicka dem

Blocket visar kopian efter fångst. Tryck **▶** för att gå tillbaka till den levande
sidan; blocket behåller båda.

### Ordna om

Varje block har en liten verktygsrad till höger i huvudet:

| Knapp | Gör |
|---|---|
| **↑ ↓** | flytta blocket upp eller ner |
| **▾ ▸** | fäll ihop eller ut |
| **⧉** | duplicera |
| **✕** | radera |

### Redigera allt som text

Knappen **Text** uppe till höger visar hela anteckningsboken som råtext:
Markdown-snuttar varvat med webbadresser, en per rad.

```
# Leverantörer

Tre kandidater. A är billigast men har sämst support.

https://example.com/leverantor-a

## Leverantör B
Dyrare, men bättre avtal.

https://example.org/leverantor-b
```

En rad som **bara** innehåller en adress blir ett sidblock. Allt annat blir text.
Prosa som råkar nämna en domän lämnas i fred.

Det gör dokumentet klistrbart: skriv anteckningar och länkar var som helst, klistra
in alltihop och spara. Sparade kopior följer med sina adresser, så du kan skriva om
texten eller flytta om raderna utan att tappa något du fångat.

**Spara** eller **Cmd+Enter** verkställer. **Avbryt** eller **Esc** slänger ändringen.

---

## Var dina saker ligger

Dokument och sparade sidkopior ligger på din egen disk:

| System | Plats |
|---|---|
| macOS | `~/Library/Application Support/TabFlow/tabflow` |
| Linux | `~/.config/TabFlow/tabflow` |

Vill du säkerhetskopiera eller flytta till en annan dator är det den mappen som
gäller. Inloggningar du gör i sidblock sparas separat och följer inte med.

---

## Om något strular

**Appen startar inte på macOS** — se `xattr`-kommandot under Installera.

**En sida vill inte visas.** Vissa sajter vägrar laddas utanför en vanlig
webbläsare. Tryck **↗** för att öppna den externt, och **📷** om du vill ha en
kopia i flödet ändå.

**Snapshot tar tid.** En sida som inte är vaken laddas i bakgrunden först. På tunga
sajter tar det några sekunder.
