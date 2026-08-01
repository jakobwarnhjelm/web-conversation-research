/**
 * Serialisering + migrering (avsnitt 5.2).
 *
 * `toJSON` producerar den portabla dokument-JSON:en (F-IE-1). `fromJSON` läser en
 * fil, migrerar äldre schemaversioner framåt (F-IE-2, 5.2) och validerar formen.
 *
 * Migreringar registreras som "från version N → N+1". `migrate()` kör dem i kedja
 * tills dokumentet når CURRENT_SCHEMA_VERSION. Så länge kedjan är komplett kan en fil
 * från vilken äldre version som helst importeras.
 */
import { DomainError } from "./errors.js";
import { Block, CURRENT_SCHEMA_VERSION, FlowDocument } from "./types.js";

export function toJSON(doc: FlowDocument, pretty = true): string {
  return JSON.stringify(doc, null, pretty ? 2 : 0);
}

type RawDoc = Record<string, unknown>;

/** En migrering lyfter ett dokument från `from` till `from + 1`. */
export interface Migration {
  from: number;
  migrate(doc: RawDoc): RawDoc;
}

/**
 * Registret är tomt i v1 (inga tidigare versioner finns). När schemaVersion bumpas
 * till 2 läggs { from: 1, migrate } till här — inget annat behöver ändras.
 */
export const MIGRATIONS: Migration[] = [];

export function migrate(raw: RawDoc): RawDoc {
  let current = raw;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new DomainError(
      `Dokumentets schemaVersion (${version}) är nyare än vad denna app stödjer ` +
        `(${CURRENT_SCHEMA_VERSION}). Uppdatera appen.`,
      "SCHEMA_TOO_NEW",
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new DomainError(
        `Saknar migrering från schemaVersion ${version}.`,
        "MISSING_MIGRATION",
      );
    }
    current = step.migrate(current);
    version = version + 1;
    current.schemaVersion = version;
  }
  return current;
}

function fail(msg: string): never {
  throw new DomainError(`Ogiltigt dokument: ${msg}`, "INVALID_DOCUMENT");
}

function validateBlock(b: unknown, i: number): asserts b is Block {
  if (typeof b !== "object" || b === null) fail(`block[${i}] är inte ett objekt`);
  const block = b as Record<string, unknown>;
  if (typeof block.id !== "string") fail(`block[${i}].id saknas`);
  if (block.type !== "text" && block.type !== "page") {
    fail(`block[${i}].type måste vara "text" eller "page"`);
  }
  if (block.type === "text" && typeof block.markdown !== "string") {
    fail(`block[${i}].markdown saknas`);
  }
  if (block.type === "page") {
    if (typeof block.url !== "string") fail(`block[${i}].url saknas`);
    if (typeof block.render !== "object" || block.render === null) {
      fail(`block[${i}].render saknas`);
    }
  }
}

/** Validerar den migrerade råformen och returnerar ett typat FlowDocument. */
export function validate(raw: RawDoc): FlowDocument {
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fail(`schemaVersion är inte ${CURRENT_SCHEMA_VERSION} efter migrering`);
  }
  if (typeof raw.id !== "string") fail("id saknas");
  if (typeof raw.title !== "string") fail("title saknas");
  if (!Array.isArray(raw.blocks)) fail("blocks måste vara en array");
  raw.blocks.forEach(validateBlock);
  return raw as unknown as FlowDocument;
}

export function fromJSON(text: string): FlowDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DomainError("Kunde inte tolka JSON.", "INVALID_JSON");
  }
  if (typeof parsed !== "object" || parsed === null) fail("roten är inte ett objekt");
  return validate(migrate(parsed as RawDoc));
}
