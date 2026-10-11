import type { Metadata } from "next";

export const SITE_NAME = "Quento Padel Club";

export const SITE_DESCRIPTION =
  "Reservá tu cancha de pádel en Quento Club, City Bell: mirá los turnos disponibles, armá partidos abiertos con otros jugadores y sumá puntos.";

/**
 * Imagen para compartir (Open Graph y Twitter). Se declara explícitamente en vez
 * de usar la convención `opengraph-image`, porque esa imagen se pierde en las
 * páginas que redefinen `openGraph`.
 */
const SHARE_IMAGE = "/og-image.png";

/**
 * Metadata compartida por todo el sitio (layout raíz). `metadataBase` resuelve
 * las URLs relativas de canonical y Open Graph a absolutas.
 */
export const siteMetadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "es_AR",
    url: "/",
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
} satisfies Metadata;

/**
 * Metadata propia de cada página: título y URL canónica. Open Graph y Twitter se
 * redefinen completos porque Next.js no los fusiona con los del layout.
 */
export function pageMetadata(title: string, path: string): Metadata {
  return {
    title,
    alternates: { canonical: path },
    openGraph: { ...siteMetadata.openGraph, title, url: path },
    twitter: { ...siteMetadata.twitter, title },
  };
}
