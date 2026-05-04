import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RepeatSelector } from "../src/components/RepeatSelector";

describe("RepeatSelector", () => {
  it("renders both tabs", () => {
    render(<RepeatSelector value="repeating" onChange={() => {}} />);
    ["Repeating", "One-time"].forEach((label) => {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    });
  });
  it("calls onChange with the picked value", () => {
    const onChange = vi.fn();
    render(<RepeatSelector value="repeating" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "One-time" }));
    expect(onChange).toHaveBeenCalledWith("one_time");
  });
  it("marks the current value as checked", () => {
    render(<RepeatSelector value="one_time" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "One-time" })).toHaveAttribute("aria-checked", "true");
  });
});
