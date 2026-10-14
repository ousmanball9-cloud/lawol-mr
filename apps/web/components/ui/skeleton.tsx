"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className,
  ...props
}: SkeletonProps) {
  const baseStyles = "animate-pulse bg-muted relative overflow-hidden";
  
  const variantStyles = {
    text: "h-4 w-full rounded",
    circular: "h-10 w-10 rounded-full",
    rectangular: "h-12 w-full rounded-lg",
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
    height: height ? (typeof height === "number" ? `${height}px` : height) : undefined,
  };

  return (
    <div
      data-probe={`skeleton-${variant}`}
      data-testid={`skeleton-${variant}`}
      aria-hidden="true"
      className={cn(baseStyles, variantStyles[variant], className)}
      style={style}
      {...props}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/50 to-muted"
        style={{ animation: "skeleton-pulse 1.5s ease-in-out infinite" }}
      />
    </div>
  );
}

export function SkeletonText({ lines = 3, className, ...props }: { lines?: number } & SkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("space-y-4 p-4", className)} {...props}>
      <Skeleton variant="circular" />
      <SkeletonText lines={3} />
      <Skeleton variant="rectangular" />
    </div>
  );
}