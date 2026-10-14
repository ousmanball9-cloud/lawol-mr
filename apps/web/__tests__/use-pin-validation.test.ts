import { act, renderHook } from "@testing-library/react";
import { usePinValidation, validatePin, getStrengthInfo, type PinStrength } from "@/hooks/use-pin-validation";

describe("usePinValidation", () => {
  it("returns weak for empty pin", () => {
    const { result } = renderHook(() => usePinValidation(""));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("");
    expect(result.current.score).toBe(0);
  });

  it("returns weak for pin too short", () => {
    const { result } = renderHook(() => usePinValidation("123"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Le PIN doit contenir 4 à 6 chiffres");
    expect(result.current.score).toBe(10);
  });

  it("returns weak for pin too long", () => {
    const { result } = renderHook(() => usePinValidation("1234567"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Le PIN doit contenir 4 à 6 chiffres");
    expect(result.current.score).toBe(10);
  });

  it("returns weak for repeated pattern (1111)", () => {
    const { result } = renderHook(() => usePinValidation("1111"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les répétitions (ex: 1111, 0000)");
    expect(result.current.score).toBe(15);
  });

  it("returns weak for repeated pattern (000000)", () => {
    const { result } = renderHook(() => usePinValidation("000000"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les répétitions (ex: 1111, 0000)");
    expect(result.current.score).toBe(15);
  });

  it("returns weak for ascending sequence (1234)", () => {
    const { result } = renderHook(() => usePinValidation("1234"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les séquences (ex: 1234, 6543)");
    expect(result.current.score).toBe(20);
  });

  it("returns weak for descending sequence (4321)", () => {
    const { result } = renderHook(() => usePinValidation("4321"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les séquences (ex: 1234, 6543)");
    expect(result.current.score).toBe(20);
  });

  it("returns weak for long ascending sequence (123456)", () => {
    const { result } = renderHook(() => usePinValidation("123456"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les séquences (ex: 1234, 6543)");
    expect(result.current.score).toBe(20);
  });

  it("returns weak for long descending sequence (654321)", () => {
    const { result } = renderHook(() => usePinValidation("654321"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe("Évite les séquences (ex: 1234, 6543)");
    expect(result.current.score).toBe(20);
  });

  it("returns medium for pin with moderate entropy (1928)", () => {
    // 4 unique digits, entropy = (4/10)*4*10 = 16 -> actually weak
    // Let's use 5 digits: (5/10)*5*10 = 25 -> medium
    const { result } = renderHook(() => usePinValidation("13579"));
    expect(result.current.strength).toBe("medium");
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBe("PIN acceptable — peux faire mieux");
    expect(result.current.score).toBe(60);
  });

  it("returns medium for 5-digit pin with good variety", () => {
    const { result } = renderHook(() => usePinValidation("19283"));
    expect(result.current.strength).toBe("medium");
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBe("PIN acceptable — peux faire mieux");
    expect(result.current.score).toBe(60);
  });

  it("returns strong for 6-digit pin with high entropy", () => {
    const { result } = renderHook(() => usePinValidation("135792"));
    expect(result.current.strength).toBe("strong");
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBe("PIN fort ✓");
    expect(result.current.score).toBe(100);
  });

  it("returns strong for 6 unique digits", () => {
    const { result } = renderHook(() => usePinValidation("192837"));
    expect(result.current.strength).toBe("strong");
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBe("PIN fort ✓");
    expect(result.current.score).toBe(100);
  });

  it("debounces pin changes", async () => {
    const { result, rerender } = renderHook(
      ({ pin }) => usePinValidation(pin),
      { initialProps: { pin: "" } }
    );

    expect(result.current.strength).toBe("weak");

    rerender({ pin: "135792" });
    // Immediately after rerender, should still be old value due to debounce
    expect(result.current.strength).toBe("weak");

    // Wait for debounce (150ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.strength).toBe("strong");
  });

  it("handles repeated sequences correctly", () => {
    const { result } = renderHook(() => usePinValidation("12341234"));
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
  });

  it("ignores non-digits in validation", () => {
    const { result } = renderHook(() => usePinValidation("12-34"));
    // Digits only = 1234, which is a sequence -> weak
    expect(result.current.strength).toBe("weak");
    expect(result.current.isValid).toBe(false);
  });
});

describe("validatePin (sync function)", () => {
  it("returns valid=false for empty pin", () => {
    const result = validatePin("");
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("");
  });

  it("returns valid=false for too short pin", () => {
    const result = validatePin("123");
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Le PIN doit contenir 4 à 6 chiffres");
  });

  it("returns valid=true for strong pin", () => {
    const result = validatePin("135792");
    expect(result.isValid).toBe(true);
    expect(result.message).toBe("PIN fort ✓");
  });

  it("returns valid=true for medium pin", () => {
    const result = validatePin("13579");
    expect(result.isValid).toBe(true);
    expect(result.message).toBe("PIN acceptable — peux faire mieux");
  });
});

describe("getStrengthInfo (exported for testing)", () => {
  it("returns correct structure for all strength levels", () => {
    const weak = getStrengthInfo("1111");
    expect(weak).toEqual({
      strength: "weak",
      isValid: false,
      message: "Évite les répétitions (ex: 1111, 0000)",
      score: 15,
    });

    const medium = getStrengthInfo("13579");
    expect(medium.strength).toBe("medium");
    expect(medium.isValid).toBe(true);
    expect(medium.score).toBe(60);

    const strong = getStrengthInfo("135792");
    expect(strong.strength).toBe("strong");
    expect(strong.isValid).toBe(true);
    expect(strong.score).toBe(100);
  });

  it("handles edge case: exactly 4 digits", () => {
    const result = getStrengthInfo("1234"); // sequence -> weak
    expect(result.strength).toBe("weak");
    expect(result.isValid).toBe(false);
  });

  it("handles edge case: exactly 6 digits", () => {
    const result = getStrengthInfo("135792"); // strong
    expect(result.strength).toBe("strong");
    expect(result.isValid).toBe(true);
  });
});