/** Datos del complejo que se necesitan para ubicarlo. */
export type ComplexData = {
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  mapsUrl: string | null;
};

/** Dónde queda una cancha, como se muestra en las pantallas. */
export type ComplexLocation = { name: string; address: string; city: string; mapsUrl: string };

/** Ubicación del complejo: su link a Google Maps o, si no tiene, uno armado con sus coordenadas. */
export function toComplexLocation(complex: ComplexData): ComplexLocation {
  return {
    name: complex.name,
    address: complex.address,
    city: complex.city,
    mapsUrl:
      complex.mapsUrl ??
      `https://www.google.com/maps/search/?api=1&query=${complex.latitude},${complex.longitude}`,
  };
}

/** Cada complejo una sola vez, en el orden en que aparece. */
export function uniqueComplexLocations(locations: (ComplexLocation | undefined)[]): ComplexLocation[] {
  const unique = new Map<string, ComplexLocation>();
  for (const location of locations) {
    const key = `${location?.name}|${location?.address}`;
    if (location && !unique.has(key)) unique.set(key, location);
  }
  return [...unique.values()];
}

/** Link de wa.me para el número (solo dígitos) con el mensaje inicial opcional. Sin número no hay link. */
export function whatsAppContactUrl(number: string | null | undefined, message?: string | null): string | null {
  if (!number) return null;
  const text = message?.trim();
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
}

/** El número como lo espera wa.me: solo los dígitos ("+54 9 221 604-9987" → "5492216049987"). */
export function toWhatsAppDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/** Un número de WhatsApp, con su código de país, tiene entre 10 y 15 dígitos. */
export function isValidWhatsAppNumber(digits: string): boolean {
  return /^\d{10,15}$/.test(digits);
}
