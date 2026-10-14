import { describe, it, expect, afterEach } from "vitest";
import { Skeleton, SkeletonText, SkeletonCard } from "@/components/ui/skeleton";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("Skeleton", () => {
  it("renders text variant by default", () => {
    render(<Skeleton />);
    const skeleton = screen.getByTestId("skeleton-text");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });

  it("renders circular variant", () => {
    render(<Skeleton variant="circular" />);
    const skeleton = screen.getByTestId("skeleton-circular");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders rectangular variant", () => {
    render(<Skeleton variant="rectangular" />);
    const skeleton = screen.getByTestId("skeleton-rectangular");
    expect(skeleton).toBeInTheDocument();
  });

  it("applies custom width and height", () => {
    render(<Skeleton width={200} height={50} />);
    const skeleton = screen.getByTestId("skeleton-text");
    expect(skeleton).toHaveStyle({ width: "200px", height: "50px" });
  });

  it("applies custom className", () => {
    render(<Skeleton className="custom-class" />);
    const skeleton = screen.getByTestId("skeleton-text");
    expect(skeleton).toHaveClass("custom-class");
  });
});

describe("SkeletonText", () => {
  it("renders specified number of lines", () => {
    render(<SkeletonText lines={3} />);
    const skeletons = screen.getAllByTestId("skeleton-text");
    expect(skeletons).toHaveLength(3);
  });

  it("last line is shorter (60%)", () => {
    render(<SkeletonText lines={3} />);
    const skeletons = screen.getAllByTestId("skeleton-text");
    expect(skeletons[2]).toHaveStyle({ width: "60%" });
  });
});

describe("SkeletonCard", () => {
  it("renders circular skeleton, text lines, and rectangular skeleton", () => {
    render(<SkeletonCard />);
    expect(screen.getByTestId("skeleton-circular")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton-text")).toHaveLength(3);
    expect(screen.getByTestId("skeleton-rectangular")).toBeInTheDocument();
  });
});