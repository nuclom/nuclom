import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn utility function", () => {
  it("should merge class names correctly", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional class names", () => {
    expect(cn("text-red-500", true && "bg-blue-500")).toBe("text-red-500 bg-blue-500");
    expect(cn("text-red-500", false && "bg-blue-500")).toBe("text-red-500");
  });

  it("should handle undefined and null values", () => {
    expect(cn("text-red-500", undefined, null)).toBe("text-red-500");
  });

  it("should merge conflicting Tailwind classes", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle empty input", () => {
    expect(cn()).toBe("");
  });

  it("should handle array of classes", () => {
    expect(cn(["text-red-500", "bg-blue-500"])).toBe("text-red-500 bg-blue-500");
  });

  it("should handle object with boolean values", () => {
    expect(
      cn({
        "text-red-500": true,
        "bg-blue-500": false,
        "border-gray-200": true,
      }),
    ).toBe("text-red-500 border-gray-200");
  });
});
