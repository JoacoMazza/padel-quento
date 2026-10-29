import { describe, expect, it } from "vitest";
import { toComplexLocation, uniqueComplexLocations } from "@/src/domain/complex";

const complex = {
  id: 1,
  name: "Quento Club",
  address: "Cam. Centenario 8907",
  city: "Villa Elisa",
  province: "Buenos Aires",
  postalCode: "B1894",
  latitude: -34.863726,
  longitude: -58.061057,
  mapsUrl: "https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA",
};

describe("toComplexLocation", () => {
  it("devuelve el nombre, la dirección, la ciudad y el link a Google Maps del complejo", () => {
    expect(toComplexLocation(complex)).toEqual({
      name: "Quento Club",
      address: "Cam. Centenario 8907",
      city: "Villa Elisa",
      mapsUrl: "https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA",
    });
  });

  it("sin link a Google Maps, arma uno con la latitud y la longitud", () => {
    expect(toComplexLocation({ ...complex, mapsUrl: null }).mapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=-34.863726,-58.061057",
    );
  });
});

describe("uniqueComplexLocations", () => {
  const quento = toComplexLocation(complex);
  const other = { name: "Otro complejo", address: "Calle 7 100", city: "La Plata", mapsUrl: "https://maps.example/otro" };

  it("deja una sola vez cada complejo, en el orden en que aparece", () => {
    expect(uniqueComplexLocations([quento, other, quento, undefined])).toEqual([quento, other]);
  });
});
