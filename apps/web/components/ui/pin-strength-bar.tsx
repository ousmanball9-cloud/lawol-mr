"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { usePinValidation, type PinStrength } from "@/hooks/use-pin-validation";

interface PinStrengthBarProps {
  pin: string;
  className?: string;
  showLabel?: boolean;
}

// Static class map to avoid JIT purging of dynamic classes
const strengthConfig: Record<PinStrength, { segments: number; barClass: string; labelClass: string; messageClass: string }> = {
  weak: {
    segments: 1,
    barClass: "bg-destructive", // uses DEFAULT destructive (no -500/-600)
    labelClass: "text-destructive",
    messageClass: "text-destructive",
  },
  medium: {
    segments: 2,
    barClass: "bg-amber-500",
    labelClass: "text-amber-600",
    messageClass: "text-amber-600",
  },
  strong: {
    segments: 3,
    barClass: "bg-emerald-500",
    labelClass: "text-emerald-600",
    messageClass: "text-emerald-600",
  },
};

export function PinStrengthBar({ pin, className, showLabel = true }: PinStrengthBarProps) {
  const { strength, isValid, message, score } = usePinValidation(pin);
  const config = strengthConfig[strength];

  if (!pin) {
    return null;
  }

  return (
    <div data-probe="pin-strength" className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 h-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-full rounded transition-colors duration-300",
                i < config.segments ? config.barClass : "bg-muted"
              )}
            />
          ))}
        </div>
        {showLabel && (
          <span className={cn("text-xs font-medium transition-colors duration-300", config.labelClass)}>
            {strength === "weak" ? "Faible" : strength === "medium" ? "Moyen" : "Fort"}
          </span>
        )}
      </div>
      <p className={cn("text-xs transition-colors duration-300", isValid ? "text-muted-foreground" : config.messageClass)}>
        {message}
      </p>
      {/* Debug: score visible en dev */}
      {process.env.NODE_ENV === "development" && (
        <p className="text-[10px] text-muted-foreground font-mono">Score: {score}/100</p>
      )}
    </div>
  );
}