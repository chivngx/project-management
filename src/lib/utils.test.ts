import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (clsx + tailwind-merge)", () => {
  it("joins simple class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "no", true && "yes", null, undefined)).toBe(
      "base yes"
    );
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    // tailwind-merge: later padding utility overrides earlier one.
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles objects and arrays", () => {
    expect(cn({ a: true, b: false }, ["c", { d: true, e: false }])).toBe(
      "a c d"
    );
  });
});
