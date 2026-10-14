import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Sparkline from "@/components/espace/Sparkline";

describe("Sparkline", () => {
  it("renders SVG with correct data-probe", () => {
    render(<Sparkline data={[10, 20, 15, 25, 30, 28, 35, 40]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("data-probe", "sparkline");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Évolution offres 8 semaines");
  });

  it("handles empty data gracefully", () => {
    render(<Sparkline data={[]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toBeInTheDocument();
  });

  it("handles single data point", () => {
    render(<Sparkline data={[42]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toBeInTheDocument();
  });

  it("applies custom height and color", () => {
    render(<Sparkline data={[1, 2, 3]} height={80} color="#ff0000" />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toHaveStyle({ height: "80px", color: "#ff0000" });
  });

  it("applies custom className", () => {
    render(<Sparkline data={[1, 2, 3]} className="custom-class" />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toHaveClass("custom-class");
  });

  it("renders responsive width 100%", () => {
    render(<Sparkline data={[1, 2, 3]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg).toHaveStyle({ width: "100%" });
  });
});