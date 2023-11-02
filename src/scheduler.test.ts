import { HashMap, ReadonlyDate } from "./hashable";
import {
  DAY_IN_MILLIS,
  ScheduleOverrides,
  SchedulingParameters,
  createSchedule,
  isValidPlacement,
} from "./scheduler";

describe("createSchedule", () => {
  it("should create a valid schedule with no overrides", () => {
    const params = SchedulingParameters({
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 30,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    });
    const result = createSchedule(params);
    validateSchedule(result, params);
  });

  it("should create a valid schedule with a single override", () => {
    const params = {
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 30,
      intervalDurationMs: DAY_IN_MILLIS,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
      overrides: ScheduleOverrides([[new ReadonlyDate("2020-01-15"), "A"]]),
    };
    const result = createSchedule(params);
    validateSchedule(result, params);
  });

  it("should create a valid schedule with multiple overrides", () => {
    const params = {
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 30,
      intervalDurationMs: DAY_IN_MILLIS,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
      overrides: ScheduleOverrides([
        [new ReadonlyDate("2020-01-15"), "A"],
        [new ReadonlyDate("2020-01-24"), "B"],
      ]),
    };
    const result = createSchedule(params);
    validateSchedule(result, params);
  });

  it("should allow invalid overrides", () => {
    const params = {
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 30,
      intervalDurationMs: DAY_IN_MILLIS,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
      overrides: ScheduleOverrides([
        [new ReadonlyDate("2020-01-15"), "A"],
        [new ReadonlyDate("2020-01-16"), "A"],
      ]),
    };
    const result = createSchedule(params);
    const reruns = findInvalidReruns(result, params);
    expect([...reruns.keys()]).toEqual(["A"]);
  });

  it("should not create new invalid overrides", () => {
    const params = {
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 7,
      intervalDurationMs: DAY_IN_MILLIS,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
      overrides: ScheduleOverrides([
        [new ReadonlyDate("2020-01-01"), "A"],
        [new ReadonlyDate("2020-01-02"), "B"],
        [new ReadonlyDate("2020-01-03"), "C"],
        // Gap to fill in cannot be "A", "B", or "C", so it should choose "D"
        [new ReadonlyDate("2020-01-05"), "A"],
        [new ReadonlyDate("2020-01-06"), "B"],
        [new ReadonlyDate("2020-01-07"), "C"],
      ]),
    };
    const result = createSchedule(params);
    validateSchedule(result, params);
    expect(result.get(new ReadonlyDate("2020-01-04"))).toBe("D");
  });

  it("should be predictable, based on order of values", () => {
    const params = {
      values: ["A", "B", "C", "D", "E", "F", "G", "H"],
      start: new ReadonlyDate("2020-01-01"),
      intervals: 10,
      intervalDurationMs: DAY_IN_MILLIS,
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
      overrides: ScheduleOverrides([
        [new ReadonlyDate("2020-01-01"), "A"],
        [new ReadonlyDate("2020-01-02"), "B"],
        // Should choose E
        [new ReadonlyDate("2020-01-04"), "C"],
        [new ReadonlyDate("2020-01-05"), "D"],
        // Should choose H
        [new ReadonlyDate("2020-01-07"), "F"],
        [new ReadonlyDate("2020-01-08"), "G"],
        [new ReadonlyDate("2020-01-09"), "H"],
        // Should choose A
      ]),
    };
    const result = createSchedule(params);
    validateSchedule(result, params);
    expect(result.get(new ReadonlyDate("2020-01-03"))).toBe("E");
    expect(result.get(new ReadonlyDate("2020-01-06"))).toBe("H");
    expect(result.get(new ReadonlyDate("2020-01-10"))).toBe("A");
  });
});

describe("isValidPlacement", () => {
  const now = new ReadonlyDate();

  it("should return true when previous placement is long enough in the past", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() - params.allowRerunsAfterMs - 1),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(true);
  });

  it("should return false when previous placement is too recent in the past", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() - params.allowRerunsAfterMs),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(false);
  });

  it("should return true when next placement is long enough in the future", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() + params.allowRerunsAfterMs + 1),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(true);
  });

  it("should return true when next placement is too soon in the future", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() + params.allowRerunsAfterMs),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(false);
  });

  it("should return true when the placement is between a past and future placement", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() - params.allowRerunsAfterMs - 1),
      new ReadonlyDate(now.getTime() + params.allowRerunsAfterMs + 1),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(true);
  });

  it("should return false when the placement is both too recent to a past and future placement", () => {
    const placements = new HashMap<string, ReadonlyDate[]>();
    const params = {
      allowRerunsAfterMs: 2 * DAY_IN_MILLIS,
    };
    placements.set("A", [
      new ReadonlyDate(now.getTime() - params.allowRerunsAfterMs),
      new ReadonlyDate(now.getTime() + params.allowRerunsAfterMs),
    ]);
    const result = isValidPlacement("A", now, placements, params);
    expect(result).toBe(false);
  });
});

function validateSchedule<V>(
  schedule: Iterable<readonly [ReadonlyDate, V]>,
  params: SchedulingParameters<V>
): void {
  // Verify that the dates of the schedule are sorted chronologically
  validateSortedDates(schedule);

  // Create a copy of the schedule
  const scheduleMap = new Map(schedule);

  // Verify that all the overrides are present in schedule
  const unmatchedOverrides = findUnmatchedOverrides(schedule, params);
  if (unmatchedOverrides.size > 0) {
    const unmatchedOverrideDates = Array.from(
      unmatchedOverrides,
      ([[at, value], otherDates]) => {
        const actual = scheduleMap.get(at);
        const actualString = actual
          ? `not ${actual}`
          : "but nothing is scheduled";
        return `${at.toLocaleDateString()} (${at.getTime()}): expected to run ${value}, ${actualString} -- ${value} is ${
          otherDates.length > 0
            ? `scheduled for ${otherDates
                .map((d) => `${d.toLocaleDateString()} (${d.getTime()})`)
                .join(", ")}`
            : "not scheduled"
        }`;
      }
    );
    throw `Schedule contained overrides that did not match the expected feature date:\n  ${unmatchedOverrideDates.join(
      "\n  "
    )}`;
  }

  const datesOutOfRange = findDatesOutOfRange(schedule, params);
  if (datesOutOfRange.size > 0) {
    const endDate = new ReadonlyDate(
      params.start.getTime() + params.intervals * params.intervalDurationMs
    );
    throw `Schedule contained the follow dates outside the range of ${params.start.getTime()} to ${endDate.toLocaleDateString()}:\n - ${Array.from(
      datesOutOfRange.entries()
    ).join("\n - ")}`;
  }

  const invalidReruns = findInvalidReruns(schedule, params);
  if (invalidReruns.size > 0) {
    // TODO: Better error message based on params.intervalDurationMs
    const repeatedValues = Array.from(invalidReruns.entries()).map(
      ([value, reruns]) => {
        return reruns
          .map(([lastSeenDate, rerunDate]) => {
            return `${value}: seen on ${lastSeenDate.toLocaleDateString()} and rerun on ${rerunDate.toLocaleDateString()} (${
              (lastSeenDate.getTime() - rerunDate.getTime()) / DAY_IN_MILLIS
            } days ago)`;
          })
          .join(", ");
      }
    );
    throw `Schedule contained reruns within ${
      params.allowRerunsAfterMs / DAY_IN_MILLIS
    } days:\n - ${repeatedValues.join("\n - ")}}`;
  }
}

function pivotAll<K, V>(map: Iterable<readonly [K, V]>): HashMap<V, K[]> {
  const result = new HashMap<V, K[]>();
  for (const [key, value] of map) {
    result.update(value, (keys) => {
      keys = keys ?? [];
      keys.push(key);
      return keys;
    });
  }
  return result;
}

function validateSortedDates<V>(
  schedule: Iterable<readonly [ReadonlyDate, V]>
): void {
  // Collect only the dates of the schedule
  const dates = Array.from(schedule, ([date, _]) => date);

  // Verify that the dates are ordered chronologicaly
  // TODO: Does .sort() work?
  const sortedDates = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  expect(dates).toEqual(sortedDates);
}

function findDatesOutOfRange<V>(
  schedule: Iterable<readonly [ReadonlyDate, V]>,
  params: Pick<
    SchedulingParameters<unknown>,
    "start" | "intervals" | "intervalDurationMs"
  >
): HashMap<V, ReadonlyDate[]> {
  const datesOutOfRange = new HashMap<V, ReadonlyDate[]>();
  const endMs =
    params.start.getTime() + params.intervals * params.intervalDurationMs;
  for (const [date, value] of schedule) {
    if (date.getTime() < params.start.getTime() || date.getTime() > endMs) {
      datesOutOfRange.update(value, (dates) => {
        dates = dates ?? [];
        dates.push(date);
        return dates;
      });
    }
  }
  return datesOutOfRange;
}

function findUnmatchedOverrides<V>(
  schedule: Iterable<readonly [ReadonlyDate, V]>,
  params: Pick<SchedulingParameters<V>, "overrides">
): HashMap<[ReadonlyDate, V], ReadonlyDate[]> {
  const unmatchedOverrides = new HashMap<[ReadonlyDate, V], ReadonlyDate[]>();
  const allDatesByValue = pivotAll(schedule);
  for (const [date, value] of params.overrides) {
    const foundDates = allDatesByValue.get(value) ?? [];
    if (!foundDates.some((d) => +d === +date)) {
      unmatchedOverrides.set([date, value], foundDates);
    }
  }
  return unmatchedOverrides;
}

function findInvalidReruns<V>(
  schedule: Iterable<readonly [ReadonlyDate, V]>,
  params: Pick<SchedulingParameters<unknown>, "allowRerunsAfterMs">
): Map<V, [ReadonlyDate, ReadonlyDate][]> {
  const reruns = new Map<V, [ReadonlyDate, ReadonlyDate][]>();
  const lastSeen = new Map<V, ReadonlyDate>();
  for (const [date, value] of schedule) {
    const lastSeenDate = lastSeen.get(value);
    if (
      lastSeenDate &&
      date.getTime() - lastSeenDate.getTime() < params.allowRerunsAfterMs
    ) {
      const entry: [ReadonlyDate, ReadonlyDate] = [lastSeenDate, date];
      const entries = reruns.get(value);
      if (entries) {
        entries.push(entry);
      } else {
        reruns.set(value, [entry]);
      }
    }
    lastSeen.set(value, date);
  }
  return reruns;
}
