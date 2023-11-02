import { Hash, HashMap, ReadonlyDate } from "./hashable";

describe("Hash", () => {
  it("should hash to the same value for the same object", () => {
    expect(Hash({}) === Hash({})).toBe(true);
  });

  it("should hash to the same value for the same tuple", () => {
    expect(Hash([]) === Hash([])).toBe(true);
  });

  it("should hash to the same value for the same string", () => {
    expect(Hash("") === Hash("")).toBe(true);
  });

  it("should not compile when using different sized tuples", () => {
    // @ts-expect-error
    expect(Hash(["a", 1]) === Hash(["b"])).toBe(false);
    // @ts-expect-error
    expect(Hash(["a", 1, "c"]) === Hash(["b", 2])).toBe(false);
    // @ts-expect-error
    expect(Hash(["a", 1]) === Hash(["b", 2, "c"])).toBe(false);
  });

  it("should the string literal type", () => {
    const hashA = Hash("A");
    const hashB = Hash("B");
    // @ts-expect-error
    expect(hashA === hashB).toBe(false);
  });
});

describe("HashMap", () => {
  it("should keep the insert order of entries", () => {
    const ordered = new HashMap<string, number>([
      ["c", 3],
      ["b", 2],
    ]);
    ordered.set("a", 1);
    expect(Array.from(ordered.entries())).toEqual([
      ["c", 3],
      ["b", 2],
      ["a", 1],
    ]);
  });

  it("should use never for the key and value type of the empty constructor", () => {
    const map = new HashMap();
    // @ts-expect-error
    map.set("a", 1);
  });

  it("should widen the value type when using the updated method", () => {
    const map = new HashMap().updated("a", 1);
    const a = map.get("a");
    expect(a + 1).toBe(2); // value is type number
    // @ts-expect-error
    expect([...map.keys()][0].length).toBe(1); // key is invariant, so it is still unknown
  });

  it("should widen the key type when using the updated method", () => {
    const map = new HashMap().updated("a", 1);
    const a = map.get("a");
    expect(a + 1).toBe(2);
  });

  it("should be invariant on the key", () => {
    function inv(map: HashMap<string, number>): HashMap<string, number> {
      return map;
    }
    const literal = new HashMap<"a" | "b", number>([["a", 1]]);
    literal.set("b", 2);
    // @ts-expect-error
    inv(literal);
  });

  it("should be covariant on the value", () => {
    function inv(map: HashMap<string, number>): HashMap<string, number> {
      return map;
    }
    const literal = new HashMap<string, 1 | 2>([["a", 1]]);
    literal.set("b", 2);
    expect(inv(literal) === literal).toBe(true);
  });

  it("should be able to store and retrieve tuples (unlike Map)", () => {
    const invalid = new Map([[["a", 1], "value"]]);
    expect(invalid.has(["a", 1])).toBe(false);

    const valid = new HashMap([[["a", 1], "value"]]);
    expect(valid.has(["a", 1])).toBe(true);
  });

  it("should be able to store and retrieve objects (unlike Map)", () => {
    const invalid = new Map([[{ name: "a", age: 1 }, "value"]]);
    expect(invalid.has({ name: "a", age: 1 })).toBe(false);

    const valid = new HashMap([[{ name: "a", age: 1 }, "value"]]);
    expect(valid.has({ name: "a", age: 1 })).toBe(true);
  });

  it("should be able to store and retrieve dates (unlike Map)", () => {
    const invalid = new Map([[new ReadonlyDate(1), "value"]]);
    expect(invalid.has(new ReadonlyDate(1))).toBe(false);

    const valid = new HashMap([[new ReadonlyDate(1), "value"]]);
    expect(valid.has(new ReadonlyDate(1))).toBe(true);
  });

  it("should be able to store and retrieve deeply nested objects (unlike Map)", () => {
    type NestedExample = {
      id: string;
      users: {
        name: string;
        age: number;
        created: ReadonlyDate;
      }[];
    };
    const createNewExample: () => NestedExample = () => ({
      id: "1",
      users: [{ name: "a", age: 1, created: new ReadonlyDate(1) }],
    });
    const a1 = createNewExample();
    const a2 = createNewExample();

    const invalid = new Map([[a1, "value"]]);
    expect(invalid.has(a2)).toBe(false);

    const valid = new HashMap([[a1, "value"]]);
    expect(valid.has(a2)).toBe(true);
  });

  it("should be detect differences in deeply nested objects", () => {
    type NestedExample = {
      id: string;
      users: {
        name: string;
        age: number;
        created: ReadonlyDate;
      }[];
    };
    const a1 = {
      id: "1",
      people: [{ name: "a", age: 1, created: new ReadonlyDate(1) }],
    };
    const a2 = {
      id: "1",
      people: [{ name: "a", age: 2, created: new ReadonlyDate(1) }],
    };

    const map = new HashMap([
      [a1, "value1"],
      [a2, "value2"],
    ]);
    expect(map.get(a2)).toBe("value2");
  });
});

describe("ReadonlyDate", () => {
  it("suffers from the same INSANE definition of equality carried over from JavaScript", () => {
    expect(new ReadonlyDate(1) != new ReadonlyDate(1)).toBe(true);
  });

  it("should equal the same value using the valueOf() operator", () => {
    expect(+new ReadonlyDate(1) === +new ReadonlyDate(1)).toBe(true);
  });

  it("should equal the same value using deep equality", () => {
    expect(new ReadonlyDate(1)).toEqual(new ReadonlyDate(1));
  });

  it("should hash to the same value", () => {
    expect(Hash(new ReadonlyDate(1)) === Hash(new ReadonlyDate(1))).toBe(true);
  });
});
