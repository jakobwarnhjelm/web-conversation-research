/**
 * Typad vy av `window.tabflow` (se electron/preload.ts). Adaptrarna nedanför
 * översätter portarna till dessa anrop och ingenting annat i renderaren rör dem.
 */
import type { DocumentSummary } from "@tabflow/app/ports";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SyncItem {
  blockId: string;
  url: string;
  bounds: Bounds | null;
}

export interface SyncResult {
  liveIds: string[];
  liveCount: number;
  processCount: number;
}

export interface CaptureResult {
  imageRef: string;
  textHtmlRef: string;
  title: string;
  capturedAt: string;
  fullPage: boolean;
}

export interface TabflowBridge {
  views: {
    sync(items: SyncItem[]): Promise<SyncResult>;
    reload(blockId: string): Promise<void>;
  };
  capture(blockId: string, url: string): Promise<CaptureResult>;
  docs: {
    list(): Promise<DocumentSummary[]>;
    load(id: string): Promise<string | null>;
    save(summary: DocumentSummary, json: string): Promise<void>;
    delete(id: string): Promise<void>;
  };
  blobs: {
    put(bytes: Uint8Array, mime: string): Promise<string>;
    get(ref: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
    delete(ref: string): Promise<void>;
  };
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    tabflow: TabflowBridge;
  }
}

export function bridge(): TabflowBridge {
  if (!window.tabflow) {
    throw new Error("window.tabflow saknas — preload-skriptet kördes inte");
  }
  return window.tabflow;
}
