export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const errBlockNotFound = (id: string) =>
  new DomainError(`Block hittades inte: ${id}`, "BLOCK_NOT_FOUND");

export const errWrongBlockType = (id: string, expected: string, actual: string) =>
  new DomainError(
    `Block ${id} har fel typ (förväntade ${expected}, fick ${actual})`,
    "WRONG_BLOCK_TYPE",
  );

export const errAnchorNotFound = (id: string) =>
  new DomainError(`Ankarblock för infogning hittades inte: ${id}`, "ANCHOR_NOT_FOUND");
