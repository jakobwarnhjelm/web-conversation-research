/**
 * TabFlow — spårsagnostisk domänmodell (M0).
 *
 * Detta är den delade kärnan (avsnitt 5 i kravspecen). Den känner INTE till
 * React, Electron eller Chrome. Renderare (Spår A/B) tolkar `PageBlock.render`.
 *
 * Reglerna för fälten står i avsnitt 5.2. Binärt innehåll (bilder, HTML-snapshots)
 * lagras ALDRIG inline här — bara referenser (`imageRef` m.fl.) till en BlobStore.
 */

/** Aktuell schemaversion. Bumpas vid brytande ändringar; se `migrate()`. */
export const CURRENT_SCHEMA_VERSION = 1;

export type BlockType = "text" | "page";

/** Fördefinierade höjdsteg (12.4). Fritt px-tal tillåts också som override. */
export type BlockHeightStep = "small" | "medium" | "large";
export type BlockHeight = BlockHeightStep | number;

/** Pixelvärden för höjdstegen (12.4). Källa för höjdreservation i virtualisering. */
export const HEIGHT_STEP_PX: Record<BlockHeightStep, number> = {
  small: 240,
  medium: 480,
  large: 720,
};

/** Hur ett sidblock ritas. `mode` = vilken artefakt som finns/är default-läge. */
export type RenderMode = "snapshot" | "live";
/** Vilken artefakt som faktiskt visas just nu (per-block live/snapshot-växel, F-SNAPWF-8). */
export type RenderDisplay = "snapshot" | "live";

export interface SnapshotArtifact {
  /** Grafisk kopia (obligatorisk för en snapshot). Referens till BlobStore. */
  imageRef: string;
  /** Statisk, avskalad text-HTML "i bakgrunden" (obligatorisk, 4.5). */
  textHtmlRef: string;
  /** Valfri full SingleFile-HTML med inline:ade resurser (F-SNAP-9). */
  singleFileRef: string | null;
  /** Om den grafiska kopian täcker hela sidhöjden (F-SNAP-8). */
  fullPage: boolean;
  capturedAt: string;
}

export interface PageRender {
  mode: RenderMode;
  display: RenderDisplay;
  /** Finns endast när blocket har en sparad snapshot. Ett block kan ha BÅDE
   *  live och snapshot samtidigt (F-SNAPWF-8) — då är detta satt och mode kan vara "live". */
  snapshot: SnapshotArtifact | null;
}

interface BlockBase {
  id: string;
  collapsed: boolean;
}

export interface TextBlock extends BlockBase {
  type: "text";
  markdown: string;
}

export interface PageBlock extends BlockBase {
  type: "page";
  url: string;
  title: string;
  /** Får vara en data:-URI eller referens; hålls liten. */
  favicon: string | null;
  height: BlockHeight;
  /** Kort etikett/anteckning på själva blocket (F-SID-5). */
  label: string | null;
  capturedAt: string | null;
  render: PageRender;
}

export type Block = TextBlock | PageBlock;

export interface FlowDocument {
  schemaVersion: number;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  /** Ordnad array — ordningen ÄR scrollordningen (5.2). */
  blocks: Block[];
}

/** Position vid infogning (F-CAP-3): överst, underst, eller efter ett givet block-id. */
export type InsertPosition =
  | { at: "top" }
  | { at: "bottom" }
  | { at: "after"; blockId: string }
  | { at: "before"; blockId: string }
  | { at: "index"; index: number };

/** Injicerade beroenden så kärnan förblir ren/deterministisk och testbar. */
export interface Clock {
  now(): string; // ISO 8601
}

export interface IdGenerator {
  block(): string;
  document(): string;
}
