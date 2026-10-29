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
