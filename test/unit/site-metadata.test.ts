import { describe, expect, it } from "vitest";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME, siteMetadata } from "@/app/site-metadata";
import manifest from "@/app/manifest";

describe("siteMetadata", () => {
  it("usa el nombre del sitio como título por defecto y como plantilla de los títulos de cada página", () => {
    expect(siteMetadata.title).toEqual({ default: SITE_NAME, template: `%s | ${SITE_NAME}` });
  });

  it("tiene una descripción de entre 120 y 160 caracteres", () => {
    expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(siteMetadata.description).toBe(SITE_DESCRIPTION);
  });

  it("define una URL base para resolver las URLs absolutas de canonical y Open Graph", () => {
    expect(siteMetadata.metadataBase).toBeInstanceOf(URL);
  });

  it("configura Open Graph como sitio web en español", () => {
    expect(siteMetadata.openGraph).toMatchObject({
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      locale: "es_AR",
      url: "/",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: SITE_NAME }],
    });
  });

  it("configura la Twitter Card con imagen grande", () => {
    expect(siteMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: ["/og-image.png"],
    });
  });
});

describe("pageMetadata", () => {
  it("define el título, la URL canónica y la URL de Open Graph de la página", () => {
    expect(pageMetadata("Mis turnos", "/my-bookings")).toEqual({
      title: "Mis turnos",
      alternates: { canonical: "/my-bookings" },
      openGraph: { ...siteMetadata.openGraph, title: "Mis turnos", url: "/my-bookings" },
      twitter: { ...siteMetadata.twitter, title: "Mis turnos" },
    });
  });
});

describe("manifest", () => {
  it("describe la app con su nombre y los íconos de 192x192 y 512x512", () => {
    const result = manifest();

    expect(result.name).toBe(SITE_NAME);
    expect(result.short_name).toBe("Quento");
    expect(result.description).toBe(SITE_DESCRIPTION);
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.icons).toEqual([
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });
});
