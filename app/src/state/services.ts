import { createContext, useContext } from "react";
import type { BlobStore, SidblockRenderer, TabController } from "../ports";
import type { DocumentActions } from "./useDocument";

/** Tjänster som block-komponenterna behöver, utan prop-drilling. */
export interface AppServices {
  actions: DocumentActions;
  renderer: SidblockRenderer;
  blobs: BlobStore;
  tabs: TabController;
}

const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;

export function useServices(): AppServices {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices måste användas inom <ServicesProvider>");
  return s;
}
