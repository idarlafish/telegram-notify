import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RepeatSelector } from "../src/components/RepeatSelector";

describe("RepeatSelector", () => {
  it("renders all 5 options", () => {
    render(<RepeatSelector value="daily" onChange={() => {}} />);
    ["Daily","Weekdays","Weekends","Custom","One-time"].forEach((label) => {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    });
  });
  it("calls onChange with the picked value", () => {
    const onChange = vi.fn();
    render(<RepeatSelector value="daily" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(onChange).toHaveBeenCalledWith("custom");
  });
  it("marks the current value as checked", () => {
    render(<RepeatSelector value="weekdays" onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Weekdays" })).toHaveAttribute("aria-checked", "true");
  });
});
