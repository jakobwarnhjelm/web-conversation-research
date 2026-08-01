import { Clock } from "../src/types.js";
import { createCounterIdGenerator } from "../src/factory.js";

/** Deterministisk klocka: varje anrop stegar en sekund så updatedAt syns ändras. */
export function fixedClock(startIso = "2026-08-01T10:00:00.000Z"): Clock {
  let t = Date.parse(startIso);
  return {
    now() {
      const iso = new Date(t).toISOString();
      t += 1000;
      return iso;
    },
  };
}

export function testDeps(idSeed = 0) {
  return { ids: createCounterIdGenerator(idSeed), clock: fixedClock() };
}
