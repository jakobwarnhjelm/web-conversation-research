import type { Clock, IdGenerator } from "@tabflow/domain";

/** Unika id:n i produktion (domänens counter-generator är bara för tester). */
export const uuidIds: IdGenerator = {
  block: () => "blk_" + crypto.randomUUID().slice(0, 8),
  document: () => "flow_" + crypto.randomUUID().slice(0, 8),
};

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};
