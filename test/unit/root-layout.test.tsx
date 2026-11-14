import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Plus_Jakarta_Sans: () => ({ variable: "font-jakarta" }),
  Outfit: () => ({ variable: "font-outfit" }),
}));

import RootLayout from "@/app/layout";
import { WhatsAppButton } from "@/app/components/whatsapp-button";

function containsElementOfType(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => containsElementOfType(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === type || containsElementOfType(node.props.children, type);
}

describe("RootLayout", () => {
  it("muestra el botón de WhatsApp en todas las páginas", () => {
    const layout = RootLayout({ children: null } as Parameters<typeof RootLayout>[0]);

    expect(containsElementOfType(layout, WhatsAppButton)).toBe(true);
  });
});
