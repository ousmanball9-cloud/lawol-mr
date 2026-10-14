import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PostesBarres from "@/components/espace/PostesBarres";

describe("PostesBarres", () => {
  const sampleData = [
    { poste: "Développeur Full Stack", count: 45 },
    { poste: "Designer UX/UI", count: 30 },
    { poste: "Data Scientist", count: 15 },
    { poste: "DevOps Engineer", count: 10 },
  ];

  it("renders with correct data-probe", () => {
    render(<PostesBarres data={sampleData} />);
    const container = screen.getByTestId("postes-barres");
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute("data-probe", "postes-barres");
    expect(container).toHaveAttribute("role", "list");
  });

  it("renders all postes with correct counts", () => {
    render(<PostesBarres data={sampleData} />);
    expect(screen.getByText("Développeur Full Stack")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("Designer UX/UI")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Data Scientist")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("DevOps Engineer")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("calculates maxCount automatically when not provided", () => {
    render(<PostesBarres data={sampleData} />);
    const container = screen.getByTestId("postes-barres");
    const bars = container.querySelectorAll('[role="img"]');
    const firstBar = bars[0] as HTMLElement;
    expect(firstBar).toHaveStyle({ width: "100%" });
  });

  it("uses provided maxCount for normalization", () => {
    render(<PostesBarres data={sampleData} maxCount={100} />);
    const container = screen.getByTestId("postes-barres");
    const bars = container.querySelectorAll('[role="img"]');
    const firstBar = bars[0] as HTMLElement;
    expect(firstBar).toHaveStyle({ width: "45%" });
  });

  it("handles empty data array", () => {
    render(<PostesBarres data={[]} />);
    const container = screen.getByTestId("postes-barres");
    expect(container).toBeInTheDocument();
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(0);
  });

  it("handles single data item", () => {
    render(<PostesBarres data={[{ poste: "Unique", count: 100 }]} />);
    expect(screen.getByText("Unique")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    const bar = screen.getByRole("img");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("handles zero count", () => {
    render(<PostesBarres data={[{ poste: "Zero", count: 0 }]} />);
    const bar = screen.getByRole("img");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("applies correct background classes (light mode)", () => {
    render(<PostesBarres data={sampleData} />);
    const container = screen.getByTestId("postes-barres");
    const barContainers = container.querySelectorAll("div.relative.h-6");
    expect(barContainers[0]).toHaveClass("bg-signature/10");
    const barFills = container.querySelectorAll('[role="img"]');
    expect(barFills[0]).toHaveClass("bg-signature");
  });

  it("applies dark mode classes", () => {
    render(<PostesBarres data={sampleData} />);
    const container = screen.getByTestId("postes-barres");
    const barContainers = container.querySelectorAll("div.relative.h-6");
    expect(barContainers[0]).toHaveClass("dark:bg-signature/20");
    const barFills = container.querySelectorAll('[role="img"]');
    expect(barFills[0]).toHaveClass("dark:bg-signature");
  });

  it("shows tooltip on hover with count and poste", () => {
    render(<PostesBarres data={sampleData} />);
    const container = screen.getByTestId("postes-barres");
    const firstBar = container.querySelector('[role="listitem"]')?.querySelector('[role="img"]');
    expect(firstBar).toHaveAttribute("aria-label", "Développeur Full Stack : 45 candidatures");

    const tooltip = firstBar?.nextElementSibling;
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("45 — Développeur Full Stack");
    expect(tooltip).toHaveClass("opacity-0");
    expect(tooltip).toHaveClass("invisible");
  });

  it("applies custom className", () => {
    render(<PostesBarres data={sampleData} className="custom-bars" />);
    const container = screen.getByTestId("postes-barres");
    expect(container).toHaveClass("custom-bars");
  });

  it("truncates long poste names", () => {
    render(<PostesBarres data={[{ poste: "A".repeat(100), count: 10 }]} />);
    const posteText = screen.getByText(new RegExp(`^${"A".repeat(50)}`));
    expect(posteText).toHaveClass("truncate");
  });
});