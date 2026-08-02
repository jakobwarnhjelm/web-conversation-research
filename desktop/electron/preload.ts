/**
 * Bryggan mellan renderaren och main. Allt spårspecifikt går genom `window.tabflow`;
 * renderarens adaptrar (src/adapters/) är tunna översättningar från portarna hit.
 * Ingen Electron-modul och ingen Node-API läcker ut i renderaren (avsnitt 9).
 */
import { contextBridge, ipcRenderer } from "electron";

const api = {
  views: {
    sync: (items: unknown[]) => ipcRenderer.invoke("tabflow:views:sync", items),
    reload: (blockId: string) => ipcRenderer.invoke("tabflow:views:reload", blockId),
  },
  capture: (blockId: string | null, url: string, options?: { archive?: boolean }) =>
    ipcRenderer.invoke("tabflow:capture", { blockId, url, archive: options?.archive === true }),
  session: {
    clear: () => ipcRenderer.invoke("tabflow:session:clear"),
  },
  docs: {
    list: () => ipcRenderer.invoke("tabflow:docs:list"),
    load: (id: string) => ipcRenderer.invoke("tabflow:docs:load", id),
    save: (summary: unknown, json: string) => ipcRenderer.invoke("tabflow:docs:save", { summary, json }),
    delete: (id: string) => ipcRenderer.invoke("tabflow:docs:delete", id),
  },
  blobs: {
    put: (bytes: Uint8Array, mime: string) => ipcRenderer.invoke("tabflow:blobs:put", { bytes, mime }),
    get: (ref: string) => ipcRenderer.invoke("tabflow:blobs:get", ref),
    delete: (ref: string) => ipcRenderer.invoke("tabflow:blobs:delete", ref),
    open: (ref: string) => ipcRenderer.invoke("tabflow:blobs:open", ref),
    reveal: (ref: string) => ipcRenderer.invoke("tabflow:blobs:reveal", ref),
  },
  openExternal: (url: string) => ipcRenderer.invoke("tabflow:shell:open", url),
};

contextBridge.exposeInMainWorld("tabflow", api);
