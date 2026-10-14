import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiCard from "@/components/espace/KpiCard";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

describe("KpiCard", () => {
  it("renders with correct data-probe", () => {
    render(<KpiCard icon={<ArrowUp />} label="Offres" value={42} />);
    const card = screen.getByTestId("kpi-carte-anim");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-probe", "kpi-carte-anim");
  });

  it("displays icon, label, and value", () => {
    render(<KpiCard icon={<ArrowUp />} label="Offres reçues" value="1,234" />);
    expect(screen.getByText("Offres reçues")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-carte-anim")).toContainHTML('<svg'); // icon
  });

  it("applies icon styling (bg-signature/10 text-signature)", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} />);
    const iconWrapper = screen.getByTestId("kpi-carte-anim").querySelector(".inline-flex.h-10.w-10");
    expect(iconWrapper).toHaveClass("bg-signature/10");
    expect(iconWrapper).toHaveClass("text-signature");
  });

  it("applies label styling (text-muted-foreground)", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test label" value={10} />);
    const label = screen.getByText("Test label");
    expect(label).toHaveClass("text-muted-foreground");
  });

  it("applies value styling (font-display text-3xl text-ink)", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} />);
    const value = screen.getByText("10");
    expect(value).toHaveClass("font-display");
    expect(value).toHaveClass("text-3xl");
    expect(value).toHaveClass("text-ink");
  });

  it("shows trend up with emerald color and up arrow", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} trend="up" trendValue="+12%" />);
    expect(screen.getByText("+12%")).toBeInTheDocument();
    const trendContainer = screen.getByText("+12%").parentElement;
    expect(trendContainer).toHaveClass("text-emerald-600");
    // Check for up arrow SVG
    const upArrow = trendContainer?.querySelector("svg");
    expect(upArrow).toBeInTheDocument();
  });

  it("shows trend down with red color and down arrow", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} trend="down" trendValue="-5%" />);
    expect(screen.getByText("-5%")).toBeInTheDocument();
    const trendContainer = screen.getByText("-5%").parentElement;
    expect(trendContainer).toHaveClass("text-red-600");
    const downArrow = trendContainer?.querySelector("svg");
    expect(downArrow).toBeInTheDocument();
  });

  it("shows trend neutral with muted color and horizontal line", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} trend="neutral" trendValue="0%" />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    const trendContainer = screen.getByText("0%").parentElement;
    expect(trendContainer).toHaveClass("text-muted-foreground");
    const neutralArrow = trendContainer?.querySelector("svg");
    expect(neutralArrow).toBeInTheDocument();
  });

  it("does not show trend when not provided", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} />);
    expect(screen.queryByText(/^\+?-?\d+%$/)).not.toBeInTheDocument();
  });

  it("applies custom delay via animationDelay style", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} delay={200} />);
    const card = screen.getByTestId("kpi-carte-anim");
    expect(card).toHaveStyle({ animationDelay: "200ms" });
  });

  it("applies custom className", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} className="custom-kpi" />);
    const card = screen.getByTestId("kpi-carte-anim");
    expect(card).toHaveClass("custom-kpi");
  });

  it("has correct base classes (bg-card border border-border rounded-lg p-4)", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} />);
    const card = screen.getByTestId("kpi-carte-anim");
    expect(card).toHaveClass("bg-card");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("border-border");
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("p-4");
  });

  it("has animate-kpi-enter class for animation", () => {
    render(<KpiCard icon={<ArrowUp />} label="Test" value={10} />);
    const card = screen.getByTestId("kpi-carte-anim");
    expect(card).toHaveClass("animate-kpi-enter");
  });
});