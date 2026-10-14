"use client";

import { useEffect, useMemo, useState } from "react";

export type PinStrength = "weak" | "medium" | "strong";

export interface UsePinValidationReturn {
  strength: PinStrength;
  isValid: boolean;
  message: string;
  score: number;
}

const SEQUENCES = [
  "0123", "1234", "2345", "3456", "4567", "5678", "6789",
  "9876", "8765", "7654", "6543", "5432", "4321", "3210",
  "01234", "12345", "23456", "34567", "45678", "56789",
  "98765", "87654", "76543", "65432", "54321", "43210",
  "012345", "123456", "234567", "345678", "456789",
  "987654", "876543", "765432", "654321", "543210",
];

const REPEATED_PATTERNS = [
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "00000", "11111", "22222", "33333", "44444", "55555", "66666", "77777", "88888", "99999",
  "000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999",
];

function calculateEntropy(pin: string): number {
  const uniqueDigits = new Set(pin).size;
  const length = pin.length;
  if (length === 0) return 0;
  return (uniqueDigits / 10) * length * 10;
}

function hasSequence(pin: string): boolean {
  return SEQUENCES.some((seq) => pin.includes(seq));
}

function hasRepeatedPattern(pin: string): boolean {
  return REPEATED_PATTERNS.some((pattern) => pin.includes(pattern));
}

function getStrengthInfo(pin: string): { strength: PinStrength; isValid: boolean; message: string; score: number } {
  if (!pin) {
    return { strength: "weak", isValid: false, message: "", score: 0 };
  }

  const digitsOnly = pin.replace(/\D/g, "");
  
  if (digitsOnly.length < 4 || digitsOnly.length > 6) {
    return {
      strength: "weak",
      isValid: false,
      message: "Le PIN doit contenir 4 à 6 chiffres",
      score: 10,
    };
  }

  if (hasRepeatedPattern(digitsOnly)) {
    return {
      strength: "weak",
      isValid: false,
      message: "Évite les répétitions (ex: 1111, 0000)",
      score: 15,
    };
  }

  if (hasSequence(digitsOnly)) {
    return {
      strength: "weak",
      isValid: false,
      message: "Évite les séquences (ex: 1234, 6543)",
      score: 20,
    };
  }

  const entropy = calculateEntropy(digitsOnly);
  
  if (entropy >= 30) {
    return {
      strength: "strong",
      isValid: true,
      message: "PIN fort ✓",
      score: 100,
    };
  }
  
  if (entropy >= 18) {
    return {
      strength: "medium",
      isValid: true,
      message: "PIN acceptable — peux faire mieux",
      score: 60,
    };
  }

  return {
    strength: "weak",
    isValid: true,
    message: "PIN faible — ajoute de la variété",
    score: 35,
  };
}

export function usePinValidation(pin: string): UsePinValidationReturn {
  const [debouncedPin, setDebouncedPin] = useState(pin);

  // Debounce with setTimeout + cleanup to avoid "Cannot update during render"
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPin(pin);
    }, 150);

    return () => clearTimeout(timer);
  }, [pin]);

  // Memoized calculation based on debounced pin
  const result = useMemo(() => getStrengthInfo(debouncedPin), [debouncedPin]);

  return result;
}

export function validatePin(pin: string): { isValid: boolean; message: string } {
  const result = getStrengthInfo(pin);
  return { isValid: result.isValid, message: result.message };
}

export { getStrengthInfo };