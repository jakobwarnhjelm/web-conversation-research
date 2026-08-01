import type { TabController } from "@tabflow/app/ports";
import { bridge } from "../bridge";

/** "Öppna som flik" (F-SID-4) betyder systemets webbläsare i Spår B. */
export class ShellTabController implements TabController {
  open(url: string): void {
    void bridge().openExternal(url);
  }
}
