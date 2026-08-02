import { createContext, useContext } from "react";
import type {
  BlobStore,
  GuestSessionController,
  SidblockRenderer,
  SnapshotService,
  TabController,
} from "../ports";
import type { DocumentActions } from "./useDocument";

/** Tjänster som block-komponenterna behöver, utan prop-drilling. */
export interface AppServices {
  actions: DocumentActions;
  renderer: SidblockRenderer;
  blobs: BlobStore;
  tabs: TabController;
  /** Odefinierad i spår som bara kan fånga det som är monterat. */
  snapshots?: SnapshotService;
  /** Odefinierad i spår utan egen session för inbäddade sidor. */
  guestSession?: GuestSessionController;
}

const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;

export function useServices(): AppServices {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices måste användas inom <ServicesProvider>");
  return s;
}
