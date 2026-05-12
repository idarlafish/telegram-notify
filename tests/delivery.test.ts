import { describe, it, expect } from "vitest";
import { is429, parseRetryAfter } from "../src/scheduler/user-do/delivery";

describe("is429", () => {
  it("detects error_code 429", () => {
    expect(is429({ error_code: 429, description: "Too Many Requests" })).toBe(true);
  });

  it("detects message containing 'Too Many Requests'", () => {
    expect(is429({ error_code: 400, message: "Too Many Requests: retry later" })).toBe(true);
  });

  it("returns false for non-429 errors", () => {
    expect(is429({ error_code: 400, description: "Bad Request" })).toBe(false);
  });

  it("returns false for null/undefined/non-object", () => {
    expect(is429(null)).toBe(false);
    expect(is429(undefined)).toBe(false);
    expect(is429("string")).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  it("extracts retry_after from parameters", () => {
    expect(parseRetryAfter({ parameters: { retry_after: 15 } })).toBe(15);
  });

  it("defaults to 30 when retry_after is missing", () => {
    expect(parseRetryAfter({ parameters: {} })).toBe(30);
    expect(parseRetryAfter({ parameters: { retry_after: undefined } })).toBe(30);
  });

  it("defaults to 30 when parameters object is missing", () => {
    expect(parseRetryAfter({ error_code: 429 })).toBe(30);
  });

  it("defaults to 30 for null/undefined/non-object", () => {
    expect(parseRetryAfter(null)).toBe(30);
    expect(parseRetryAfter(undefined)).toBe(30);
    expect(parseRetryAfter("string")).toBe(30);
  });
});
