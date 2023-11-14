import type { Hashable } from "./hashable";
import { ReadonlyDate, HashMap } from "./hashable";

/**
 * Creates a schedule from the given values, scheduling parameters, and a map of predefined dates to override any generated selections.
 *
 * You can provide overrides in the past or future to help the algorithm avoid scheduling the same content on dates within the
 * {@link SchedulingParameters.allowRerunsAfterMs} threshold.
 *
 * @note it may be possible for the schedule to be invalid if the overrides are not valid given the previous schedule.
 *
 * @returns a sorted Map of dates to values containing all of the override values (within the time range selected by the params).
 *
 * @throws an error if the schedule cannot be created given the parameters and values.
 */
export function createSchedule<V extends Hashable<{}>>(
  params: SchedulingParameters<V>
): HashMap<ReadonlyDate, V> {
  const { values, start, intervalDurationMs, overrides } = params;
  const slots: V[] = new Array<V>(params.intervals);

  // The placement index is a map of value to sorted dates of when the value appears
  const placementIndex: PlacementIndex<V> = new HashMap();

  function addPlacement(
    index: PlacementIndex<V>,
    value: V,
    at: ReadonlyDate
  ): void {
    index.update(value, (dates) => {
      dates = dates ?? [];
      dates.push(at);
      return dates;
    });
  }

  // Fill the placement index with the overrides
  for (const [at, value] of overrides) {
    addPlacement(placementIndex, value, at);
  }

  // TODO: Validate the overrides given the parameters?

  // Add the overrides to the nearest interval slots (overriding anything from the previous schedule)
  for (const [date, value] of overrides) {
    const slotIndex = Math.round(
      (date.getTime() - start.getTime()) / intervalDurationMs
    );
    slots[slotIndex] = value;
  }

  // These following optimizations would produce a better schedule, but will take more compute time. The first optimization speeds up the process
  // of computing the best cycle for long schedules (with few overrides) by only needing to compute the start and end of a cycle.
  // The second optimization tries to find the optimal schedule by avoiding recent reruns as much as possible.

  // TODO: Optimization: Use gaps between slots to find the first valid cycle of values to use for that gap.
  //       Using the head and tail of the values of the gap, up to the allowRerunsAfterMs limit, determine if the head and tail of the cycle is valid
  //       Fill in the gap with the cycle of values, and then do the algorithm again for the next gap.

  // TODO: Further optimization: Instead of taking the first valid cycle, find the best cycle (skipping any invalid cycles).
  //       Start by sorting the values by sum of the differences between the closest placement date at the start and end of a gap in millis.
  //       If no placement date is found for a given value at either the start or end of a gap, then use the full length of the schedule in millis.
  //       Use this score to sort the values from highest to lowest and take the first cycle as the best traversal order for the values.

  // Fill all empty slots, one-by-one, with values using the CSP algorithm
  let curIndex = 0;
  for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
    if (slots[slotIdx] == null) {
      // Compute the Date for this slot
      const at = new ReadonlyDate(
        start.getTime() + slotIdx * intervalDurationMs
      );
      // Try all values until a valid one is found or fail with an exception
      let valIdx: number = curIndex;
      let valid: boolean = false;
      let value: V;
      const endIdx = (curIndex + values.length - 1) % values.length;
      while (valIdx != endIdx && !valid) {
        valIdx = (valIdx + 1) % values.length;
        value = values[valIdx]!; // TODO: This allows null / undefined values, but should it?
        valid = isValidPlacement(value, at, placementIndex, params);
      }
      // If the valIdx is the same as the curIndex, then we have tried all values and failed
      if (valIdx === curIndex) {
        throw new Error(
          "Cannot compute a valid schedule with the given parameters and values"
        );
      }
      // Assign the slot and add the placement for the next iteration
      slots[slotIdx] = value!;
      addPlacement(placementIndex, value!, at);
      // Set the current index to the next value index and continue
      curIndex = valIdx;
    }
  }

  // Convert the slots back into a schedule
  const schedule = new Map<ReadonlyDate, V>();

  // Add the new scheduled slots
  // TODO: Should this keep the original override date? Or should it code with the rounded date?
  for (const [index, value] of slots.entries()) {
    schedule.set(
      new ReadonlyDate(start.getTime() + intervalDurationMs * index),
      value
    );
  }

  // TODO: Filter out any overrides that are outside of the schedule range?
  const scheduleArray = Array.from(
    schedule.entries(),
    ([d, v]) => [d, v] as [ReadonlyDate, V]
  );

  // Return the map from the inherently sorted array
  return new HashMap(scheduleArray);
}

/**
 * Externalized helper function for determining if a value can be placed at the given date based on the current state
 * of the placement index and the {@link SchedulingParameters.allowRerunsAfterMs} configuration.
 */
export function isValidPlacement<V>(
  next: V,
  at: ReadonlyDate,
  previousPlacements: PlacementIndex<V>,
  params: Pick<SchedulingParameters<unknown>, "allowRerunsAfterMs">
): boolean {
  const lastSeenDates = previousPlacements.get(next);
  if (!lastSeenDates) {
    return true;
  }
  // Return true if every placement date is long enough since the last (or next) rerun
  return lastSeenDates.every(
    (date) =>
      Math.abs(date.getTime() - at.getTime()) > params.allowRerunsAfterMs
  );
}

export type ScheduleOverrides<V> = HashMap<ReadonlyDate, V>;
export type ReadonlyScheduleOverrides<V> = ReadonlyMap<ReadonlyDate, V>;

/**
 * Constructs a {@link ScheduleOverrides} from the given tuples of dates and values.
 */
export function ScheduleOverrides<V>(
  tuples: Iterable<readonly [ReadonlyDate, V]>
): ScheduleOverrides<V> {
  const overrides = new HashMap<ReadonlyDate, V>();
  for (const [date, value] of tuples) {
    overrides.set(date, value);
  }
  return overrides;
}

// TODO: Add end date to the schedule parameters for overrides that fall outside of the intervals?

/**
 * The immutable parameters for the {@link createSchedule} function.
 */
export type SchedulingParameters<out V> = Readonly<{
  /**
   * The values to schedule.
   */
  values: readonly V[];

  /**
   * A predefined scheule for storing unchangable past dates or custom schedule overrides for special dates.
   *
   * NOTE: This can contain overrides that are outside of the range of generated schedule.
   */
  overrides: Iterable<readonly [ReadonlyDate, V]>;

  /**
   * The start date of the schedule.
   */
  start: ReadonlyDate;

  /**
   * The number of intervals to schedule.
   */
  intervals: number;

  /**
   * The duration of each interval in milliseconds (default is 1 * {@link DAY_IN_MILLIS}).
   */
  intervalDurationMs: number;

  /**
   * The number of milliseconds that must pass before an event can be scheduled again.
   *
   * NOTE: If this duration is less than the {@link intervalDurationMs}, then it will have no effect on the schedule.
   */
  allowRerunsAfterMs: number;
}>;

// TODO: How do I return the most specific ShedulingParameters type?
export function SchedulingParameters<V>(
  params: Pick<SchedulingParameters<V>, "values"> &
    Partial<SchedulingParameters<V>> = { values: [] }
): SchedulingParameters<V> {
  // Assign defaults and apply the given parameters over them
  return {
    start: nextHour(),
    intervals: 30,
    intervalDurationMs: DAY_IN_MILLIS,
    allowRerunsAfterMs: 7 * DAY_IN_MILLIS,
    overrides: [],
    ...params,
  };
}

type PlacementIndex<V extends Hashable<V>> = HashMap<V, ReadonlyDate[]>;

// A helpful constant for the number of milliseconds in a day
export const DAY_IN_MILLIS = 24 * 60 * 60 * 1000;

export function nextHour(from?: ReadonlyDate): ReadonlyDate {
  const hourFromNow = !from ? new Date() : new Date(+from);
  hourFromNow.setHours(hourFromNow.getHours() + 1);
  hourFromNow.setMinutes(0);
  hourFromNow.setSeconds(0);
  hourFromNow.setMilliseconds(0);
  return new ReadonlyDate(hourFromNow);
}
