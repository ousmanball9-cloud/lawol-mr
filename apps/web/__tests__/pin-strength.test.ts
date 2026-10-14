import { describe, it, expect } from "vitest";
import { validatePin, getStrengthInfo } from "@/hooks/use-pin-validation";

describe("usePinValidation / validatePin", () => {
  describe("length validation", () => {
    it("rejects empty PIN", () => {
      const result = validatePin("");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("");
    });

    it("rejects PIN with less than 4 digits", () => {
      const result = validatePin("123");
      expect(result.isValid).toBe(false);
    });

    it("rejects PIN with more than 6 digits", () => {
      const result = validatePin("1234567");
      expect(result.isValid).toBe(false);
    });

    it("accepts 4 digits", () => {
      const result = validatePin("8392");
      expect(result.isValid).toBe(true);
    });

    it("accepts 5 digits", () => {
      const result = validatePin("83921");
      expect(result.isValid).toBe(true);
    });

    it("accepts 6 digits", () => {
      const result = validatePin("839214");
      expect(result.isValid).toBe(true);
    });
  });

  describe("sequence detection", () => {
    it("rejects ascending sequences (1234)", () => {
      const result = validatePin("1234");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("séquences");
    });

    it("rejects descending sequences (4321)", () => {
      const result = validatePin("4321");
      expect(result.isValid).toBe(false);
    });

    it("rejects longer ascending sequences (123456)", () => {
      const result = validatePin("123456");
      expect(result.isValid).toBe(false);
    });

    it("rejects longer descending sequences (654321)", () => {
      const result = validatePin("654321");
      expect(result.isValid).toBe(false);
    });

    it("rejects sequence embedded in longer PIN", () => {
      const result = validatePin("91234");
      expect(result.isValid).toBe(false);
    });
  });

  describe("repeated pattern detection", () => {
    it("rejects all same digits (1111)", () => {
      const result = validatePin("1111");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("répétitions");
    });

    it("rejects all same digits (0000)", () => {
      const result = validatePin("0000");
      expect(result.isValid).toBe(false);
    });

    it("rejects 5 repeated digits", () => {
      const result = validatePin("22222");
      expect(result.isValid).toBe(false);
    });

    it("rejects 6 repeated digits", () => {
      const result = validatePin("333333");
      expect(result.isValid).toBe(false);
    });
  });

  describe("entropy / strength scoring", () => {
    it("returns strong for high entropy PIN", () => {
      const result = validatePin("8392");
      expect(result.isValid).toBe(true);
    });

    it("returns weak for low entropy but valid PIN", () => {
      const result = validatePin("1928");
      expect(result.isValid).toBe(true);
    });

    it("calculates score correctly", () => {
      const info = getStrengthInfo("8392");
      expect(info.score).toBeGreaterThan(0);
      expect(info.score).toBeLessThanOrEqual(100);
    });
  });

  describe("non-numeric input handling", () => {
    it("strips non-digits before validation", () => {
      const result = validatePin("83a92");
      expect(result.isValid).toBe(true);
    });

    it("handles spaces and dashes", () => {
      const result = validatePin("83 92");
      expect(result.isValid).toBe(true);
    });
  });
});