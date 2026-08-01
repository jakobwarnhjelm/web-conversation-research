import type { TabController } from "../ports";

/** Öppnar en URL i en ny flik. F-SID-4. I Spår A/B ersätts denna med chrome.tabs / shell.openExternal. */
export class BrowserTabController implements TabController {
  open(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
