import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn utility function", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz");
  });

  it("should handle undefined and null values", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("should merge tailwind classes correctly", () => {
    // Later classes should override earlier conflicting ones
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle object syntax", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
    expect(cn({ foo: true, bar: true })).toBe("foo bar");
  });

  it("should handle array syntax", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn(["foo"], ["bar"])).toBe("foo bar");
  });

  it("should handle mixed syntax", () => {
    expect(cn("foo", ["bar"], { baz: true })).toBe("foo bar baz");
  });

  it("should handle empty input", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });

  it("should trim whitespace", () => {
    expect(cn(" foo ", " bar ")).toBe("foo bar");
  });

  it("should handle repeated class arguments", () => {
    // Note: cn uses tailwind-merge which handles Tailwind conflicts
    // For non-Tailwind classes, both will be kept
    expect(cn("foo", "foo", "bar")).toBe("foo foo bar");
  });

  it("should handle responsive variants", () => {
    expect(cn("text-sm md:text-lg", "text-base")).toBe("md:text-lg text-base");
  });

  it("should handle hover states", () => {
    expect(cn("hover:bg-blue-500", "hover:bg-red-500")).toBe("hover:bg-red-500");
  });
});
