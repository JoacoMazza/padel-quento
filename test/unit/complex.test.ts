import { describe, expect, it } from "vitest";
import { isValidWhatsAppNumber, toComplexLocation, toWhatsAppDigits, uniqueComplexLocations, whatsAppContactUrl } from "@/src/domain/complex";

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

describe("whatsAppContactUrl", () => {
  it("arma el link de wa.me con los dígitos del número, como lo espera wa.me", () => {
    expect(whatsAppContactUrl("5492216049987")).toBe("https://wa.me/5492216049987");
    expect(whatsAppContactUrl("+54 9 221 604-9987")).toBe("https://wa.me/5492216049987");
  });

  it("agrega el mensaje inicial codificado", () => {
    expect(whatsAppContactUrl("5492216049987", "Hola, quiero reservar una cancha & consultar")).toBe(
      "https://wa.me/5492216049987?text=Hola%2C%20quiero%20reservar%20una%20cancha%20%26%20consultar",
    );
  });

  it("sin mensaje (o vacío) no agrega el parámetro text", () => {
    expect(whatsAppContactUrl("5492216049987", "  ")).toBe("https://wa.me/5492216049987");
    expect(whatsAppContactUrl("5492216049987", null)).toBe("https://wa.me/5492216049987");
  });

  it("sin número no hay link", () => {
    expect(whatsAppContactUrl(null)).toBeNull();
    expect(whatsAppContactUrl("")).toBeNull();
  });
});

describe("número de WhatsApp", () => {
  it("se guarda solo con los dígitos, como lo espera wa.me", () => {
    expect(toWhatsAppDigits("+54 9 221 604-9987")).toBe("5492216049987");
  });

  it("es válido con entre 10 y 15 dígitos (código de país incluido)", () => {
    expect(isValidWhatsAppNumber("5492216049987")).toBe(true);
    expect(isValidWhatsAppNumber("2216049987")).toBe(true);
    expect(isValidWhatsAppNumber("221604998")).toBe(false);
    expect(isValidWhatsAppNumber("5492216049987123")).toBe(false);
  });
});
