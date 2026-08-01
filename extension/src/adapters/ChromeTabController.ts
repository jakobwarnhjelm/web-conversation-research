import type { TabController } from "@tabflow/app/ports";

/** Öppnar en URL som en riktig Chrome-flik (F-SID-4). */
export class ChromeTabController implements TabController {
  open(url: string): void {
    void chrome.tabs.create({ url });
  }
}
