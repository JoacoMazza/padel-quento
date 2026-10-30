// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { AppFooter } from "@/app/components/app-footer";

describe("AppFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra el nombre del club sin la localidad al lado", () => {
    render(<AppFooter />);

    expect(screen.getByText("Quento Club")).toBeTruthy();
    expect(screen.queryByText(/· Villa Elisa/)).toBeNull();
  });

  it("en mobile deja lugar abajo para que el botón de WhatsApp no tape los links", () => {
    const { container } = render(<AppFooter />);

    const classes = container.querySelector("footer > div")!.className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["pb-24", "md:pb-8"]));
  });
});
