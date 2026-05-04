import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PrivacyPage from "../src/routes/PrivacyPage";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("PrivacyPage contact email", () => {
  it("renders the configured email when VITE_PRIVACY_CONTACT_EMAIL is set", () => {
    vi.stubEnv("VITE_PRIVACY_CONTACT_EMAIL", "ops@example.com");
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: "ops@example.com" });
    expect(link).toHaveAttribute("href", "mailto:ops@example.com");
  });

  it("renders a configure-me placeholder when the env var is unset", () => {
    vi.stubEnv("VITE_PRIVACY_CONTACT_EMAIL", "");
    render(<PrivacyPage />);
    expect(screen.getByText(/CONFIGURE_ME/)).toBeInTheDocument();
  });
});
