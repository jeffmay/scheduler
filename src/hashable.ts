/*
 * A simple library for defining a type-safe Hash function and nominal tagged type and a HashMap class that uses it.
 */

/**
 * An object is hashable if it has a valueOf(), toPrimitive(), or is an object with all hashable properties.
 */
type HashableObject<V> =
  | { valueOf(): number }
  | { [Symbol.toPrimitive]: number }
  | {
      readonly [P in keyof V]: Hashable<V[P]>;
    };

type HashableTuple<V> = readonly [Hashable<V>, ...Hashable<V>[]];

type Hashable<V> =
  | number
  | string
  | boolean
  | HashableTuple<V>
  | HashableObject<V>;

/**
 * A type-safe (ish) hash code for a type of value, so that it can be used in a {@link Map}.
 *
 * JavaScript does not support using non-primitive keys to a map (unless you are fine with reference equality).
 * This does not work for `Date`s, so we need this special kind of primitive.
 */
export type Hash<V> = string & {
  readonly __value?: V; // used to make the type dependent on the type parameter
  readonly __hash: unique symbol; // used to make this nominally typed
};

// TODO: Use valueOf() where possible?
/**
 * A stupid implementation of a hash function because JavaScript doesn't have a good definition of hash code or equality.
 */
export function Hash<V extends Hashable<V>>(value: V): Hash<V> {
  return JSON.stringify(value) as Hash<V>;
}

/**
 * A key-value pair in a {@link HashMap}.
 */
type HashMapEntry<out K, out V> = {
  readonly key: K;
  readonly value: V;
};

/**
 * A {@link Map} that uses the {@link Hash} function to create a key for a value.
 *
 * It keeps the original key along-side the value, so that both can be returned when traversing the entries.
 *
 * This extends the built-in {@link Map} class, but it does not use the backing data structure, since it has a different type.
 *
 * // TODO: Find a way to work around the type system to use the underlying map operations instead of composing a Map.
 */
export class HashMap<
  in out K extends Hashable<K> = unknown,
  out V = never
> extends Map<K, V> {
  /** Using a {@link Map} instead of an object to keep the insert order of entries */
  private hashmap: Map<Hash<K>, HashMapEntry<K, V>>;

  constructor(entries?: Iterable<readonly [K, V]>) {
    super();
    this.hashmap = new Map();
    if (entries) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  /**
   * Same as {@link set}, but returns the {@link HashMap} with more accurate types.
   */
  updated<NK, NV>(key: NK, value: NV): HashMap<K | NK, V | NV> {
    const result = this as unknown as HashMap<K | NK, V | NV>;
    result.set(key, value);
    return result;
  }

  /** @override */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  /** @override */
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: any
  ): void {
    for (const [k, v] of this.entries()) {
      callbackfn.call(thisArg, v, k, this);
    }
  }

  /** @override */
  get size(): number {
    return this.hashmap.size;
  }

  /** @override */
  clear(): void {
    this.hashmap.clear();
  }

  /** @override */
  delete(key: K): boolean {
    return this.hashmap.delete(Hash(key));
  }

  /** @override */
  get(key: K): V | undefined {
    const entry = this.hashmap.get(Hash(key));
    return entry && entry.value;
  }

  /** @override */
  update(key: K, fn: (value: V | undefined) => V | undefined): this {
    const keyHash = Hash(key);
    const entry = this.hashmap.get(keyHash);
    const result = fn(entry?.value);
    if (result === undefined) {
      this.hashmap.delete(keyHash);
    } else {
      this.hashmap.set(keyHash, { key, value: result });
    }
    return this;
  }

  /** @override */
  has(key: K): boolean {
    return this.hashmap.has(Hash(key));
  }

  /** @override */
  set(key: K, value: V): this {
    this.hashmap.set(Hash(key), { key, value });
    return this;
  }

  /** @override */
  *keys(): IterableIterator<K> {
    for (const { key } of this.hashmap.values()) {
      yield key;
    }
  }

  /** @override */
  *values(): IterableIterator<V> {
    for (const { value } of this.hashmap.values()) {
      yield value;
    }
  }

  /** @override */
  *entries(): IterableIterator<[K, V]> {
    for (const { key, value } of this.hashmap.values()) {
      yield [key, value];
    }
  }

  /** @override */
  get [Symbol.toStringTag](): string {
    let sep = ", ";
    let spacer = ", ";
    const padSize = spacer.length + sep.length;
    let strSize = "HashMap({})".length;
    const kvs = Array.from(this.hashmap, ([k, { value }]) => {
      const kv = `${k}: ${value}`;
      strSize += kv.length + padSize;
      return kv;
    });
    // if the string would be longer than 80 chars, then convert to multiline
    if (strSize > 80) {
      sep = ",\n  ";
      spacer = "\n  ";
    }
    return `HashMap({${spacer}${kvs.join(sep)}${spacer}})`;
  }
}

/**
 * A type alias for a {@link ReadonlyMap}, but retaining the hash map restrictions.
 */
export type ReadonlyHashMap<K extends Hashable<K>, V> = ReadonlyMap<K, V>;

export const ReadonlyHashMap = HashMap as {
  /**
   * Constructs a {@link ReadonlyHashMap} from the given tuples of keys and values.
   */
  new <K extends Hashable<K>, V>(
    tuples?: Iterable<readonly [K, V]>
  ): ReadonlyHashMap<K, V>;
};

/**
 * A simple constructor alias for {@link Date}.
 */
export const ReadonlyDate = Date as {
  /**
   * The current moment as a {@link ReadonlyDate}.
   */
  new (): ReadonlyDate;
  /**
   * The given epoch milliseconds, date, or Date string as a {@link ReadonlyDate}.
   */
  new (date: number | ReadonlyDate | string): ReadonlyDate;
};

/**
 * The read-only properties of the standard {@link Date} class.
 *
 * This makes it a better candidate for a key in a {@link HashMap} because it is less mutable.
 */
export type ReadonlyDate = Pick<
  Date,
  | "getDate"
  | "getDay"
  | "getFullYear"
  | "getHours"
  | "getMilliseconds"
  | "getMinutes"
  | "getMonth"
  | "getSeconds"
  | "getTime"
  | "getTimezoneOffset"
  | "getUTCDate"
  | "getUTCDay"
  | "getUTCFullYear"
  | "getUTCHours"
  | "getUTCMilliseconds"
  | "getUTCMinutes"
  | "getUTCMonth"
  | "getUTCSeconds"
  | "toString"
  | "toDateString"
  | "toJSON"
  | "toLocaleString"
  | "toLocaleDateString"
  | "toLocaleTimeString"
  | "toISOString"
  | "toUTCString"
  | "toTimeString"
  | "valueOf"
>;
