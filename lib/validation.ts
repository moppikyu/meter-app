// Plausibility checks for a new reading against the previous one.
// These are plain arithmetic rules, not machine learning — see proposal §10.

export type ReadingFlag = "none" | "decrease" | "spike" | "rollover";

const ROLLOVER_HIGH_THRESHOLD = 90000; // previous reading close to the 5-digit max (99999)
const ROLLOVER_LOW_THRESHOLD = 10000; // current reading small enough to look like a wrap-around
const SPIKE_MULTIPLIER = 4; // flag if increase is more than 4x the trailing average

export interface FlagResult {
  flag: ReadingFlag;
  increase: number;
}

/**
 * Computes the increase and any warning flag for a new reading.
 * @param current       The reading just entered.
 * @param previous      The most recent prior reading for this meter, or null if none exists yet.
 * @param digitCount    Number of whole-unit digits the meter displays (default 5, confirmed for both meter types).
 * @param trailingAverage Optional average of recent monthly increases, used for spike detection.
 */
export function evaluateReading(
  current: number,
  previous: number | null,
  digitCount: number = 5,
  trailingAverage: number | null = null
): FlagResult {
  if (previous === null) {
    return { flag: "none", increase: 0 };
  }

  const rolloverMax = Math.pow(10, digitCount);

  if (current < previous) {
    const looksLikeRollover =
      previous >= ROLLOVER_HIGH_THRESHOLD && current < ROLLOVER_LOW_THRESHOLD;

    if (looksLikeRollover) {
      const increase = rolloverMax - previous + current;
      return { flag: "rollover", increase };
    }

    // A genuine decrease that isn't a plausible rollover — likely a
    // misread, wrong meter, or meter replacement. Surface it, don't guess.
    return { flag: "decrease", increase: current - previous };
  }

  const increase = current - previous;

  if (trailingAverage && trailingAverage > 0 && increase > trailingAverage * SPIKE_MULTIPLIER) {
    return { flag: "spike", increase };
  }

  return { flag: "none", increase };
}
