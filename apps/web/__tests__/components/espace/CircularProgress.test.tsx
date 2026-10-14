import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import CircularProgress from "@/components/espace/CircularProgress";

describe("CircularProgress", () => {
  it("renders SVG with correct data-probe", () => {
    render(<CircularProgress value={50} />);
    const svg = screen.getByTestId("jauge-circulaire");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("data-probe", "jauge-circulaire");
    expect(svg).toHaveAttribute("role", "progressbar");
    expect(svg).toHaveAttribute("aria-valuenow", "50");
    expect(svg).toHaveAttribute("aria-valuemin", "0");
    expect(svg).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value to 100 when over 100", () => {
    render(<CircularProgress value={150} />);
    const svg = screen.getByTestId("jauge-circulaire");
    expect(svg).toHaveAttribute("aria-valuenow", "100");
  });

  it("clamps value to 0 when negative", () => {
    render(<CircularProgress value={-10} />);
    const svg = screen.getByTestId("jauge-circulaire");
    expect(svg).toHaveAttribute("aria-valuenow", "0");
  });

  it("applies custom size and strokeWidth", () => {
    render(<CircularProgress value={50} size={120} strokeWidth={12} />);
    const svg = screen.getByTestId("jauge-circulaire");
    expect(svg).toHaveAttribute("style", expect.stringContaining("width: 120px"));
    expect(svg).toHaveAttribute("style", expect.stringContaining("height: 120px"));
  });

  it("displays label and value", () => {
    render(<CircularProgress value={75} label="Complétion" />);
    // Value and % are in separate spans, so check for "75" and "%" separately or use a regex
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.getByText("Complétion")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CircularProgress value={50} className="custom-class" />);
    const container = screen.getByTestId("jauge-circulaire").parentElement;
    expect(container).toHaveClass("custom-class");
  });

  it("uses text-signature color for progress circle", () => {
    render(<CircularProgress value={50} />);
    const progressCircle = screen.getByTestId("jauge-circulaire").querySelector("circle:last-of-type");
    expect(progressCircle).toHaveClass("text-signature");
  });

  it("uses border color for track circle", () => {
    render(<CircularProgress value={50} />);
    const trackCircle = screen.getByTestId("jauge-circulaire").querySelector("circle:first-of-type");
    expect(trackCircle).toHaveAttribute("stroke", "hsl(var(--border))");
  });
});