import { render, screen } from "@testing-library/react";
import { PinStrengthBar } from "@/components/ui/pin-strength-bar";

describe("PinStrengthBar", () => {
  it("returns null when pin is empty", () => {
    render(<PinStrengthBar pin="" />);
    expect(screen.queryByTestId("pin-strength")).not.toBeInTheDocument();
  });

  it("renders 3 segments for strong pin", () => {
    render(<PinStrengthBar pin="135792" />); // high entropy, no sequences/repetitions
    const container = document.querySelector('[data-probe="pin-strength"]')!;
    const segments = container.querySelectorAll('[class*="flex-1 h-full"]');
    expect(segments).toHaveLength(3);
    // First 3 should be colored (emerald-500)
    expect(segments[0]).toHaveClass("bg-emerald-500");
    expect(segments[1]).toHaveClass("bg-emerald-500");
    expect(segments[2]).toHaveClass("bg-emerald-500");
  });

  it("renders 2 segments for medium pin", () => {
    // 5 digits with good variety -> medium
    render(<PinStrengthBar pin="13579" />);
    const container = document.querySelector('[data-probe="pin-strength"]')!;
    const segments = container.querySelectorAll('[class*="flex-1 h-full"]');
    expect(segments).toHaveLength(3);
    // First 2 should be colored (amber-500)
    expect(segments[0]).toHaveClass("bg-amber-500");
    expect(segments[1]).toHaveClass("bg-amber-500");
    expect(segments[2]).toHaveClass("bg-muted");
  });

  it("renders 1 segment for weak pin", () => {
    render(<PinStrengthBar pin="1111" />); // repeated pattern -> weak
    const container = document.querySelector('[data-probe="pin-strength"]')!;
    const segments = container.querySelectorAll('[class*="flex-1 h-full"]');
    expect(segments).toHaveLength(3);
    // Only first segment should be colored (destructive)
    expect(segments[0]).toHaveClass("bg-destructive");
    expect(segments[1]).toHaveClass("bg-muted");
    expect(segments[2]).toHaveClass("bg-muted");
  });

  it("shows correct label for each strength level", () => {
    // Weak
    render(<PinStrengthBar pin="1111" />);
    expect(screen.getByText("Faible")).toBeInTheDocument();

    // Medium - separate render
    const { unmount } = render(<PinStrengthBar pin="13579" />);
    expect(screen.getByText("Moyen")).toBeInTheDocument();
    unmount();

    // Strong - separate render
    render(<PinStrengthBar pin="135792" />);
    expect(screen.getByText("Fort")).toBeInTheDocument();
  });

  it("has data-probe attribute", () => {
    render(<PinStrengthBar pin="1234" />);
    expect(document.querySelector('[data-probe="pin-strength"]')).toBeInTheDocument();
  });

  it("shows message", () => {
    render(<PinStrengthBar pin="1111" />);
    expect(screen.getByText("Évite les répétitions (ex: 1111, 0000)")).toBeInTheDocument();
  });

  it("matches snapshot for strong pin", () => {
    const { container } = render(<PinStrengthBar pin="135792" />);
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot for weak pin", () => {
    const { container } = render(<PinStrengthBar pin="1111" />);
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot for empty pin (null)", () => {
    const { container } = render(<PinStrengthBar pin="" />);
    expect(container.firstChild).toBeNull();
  });
});