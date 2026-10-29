import { AdminAccessLevel, CourtState } from "@/src/domain/enums";
import type { Account } from "@/src/entities/Account";
import type { Admin } from "@/src/entities/Admin";
import type { Complex } from "@/src/entities/Complex";
import type { Court } from "@/src/entities/Court";
import { getDataSource } from "@/src/lib/db";

// Test files run serially against the same database, so each file starts from the current
// timestamp and increments: numbers never repeat within a file nor overlap with earlier files.
// Each millisecond leaves room for 1000 numbers, so a file that uses many (court tests use
// over 1000) does not run into the next one; the modulo keeps them within the int column.
let lastCourtNumber = (Date.now() % 2_000_000) * 1000;

export function uniqueCourtNumber() {
  lastCourtNumber += 1;
  return lastCourtNumber;
}

// Same idea for phone numbers: bookers.phone_number is unique, so every player or booker
// created by the tests needs its own number.
let lastPhoneNumber = Date.now() % 1_000_000_000;

export function uniquePhoneNumber() {
  lastPhoneNumber += 1;
  return `221${lastPhoneNumber}`;
}

let lastAdminSeq = Date.now() % 1_000_000;

/**
 * Crea un administrador directo en la base (sin pasar por createAdmin, que es
 * solo para el dueño). Devuelve el email con el que simular su sesión.
 */
export async function createTestAdmin(accessLevel: AdminAccessLevel = AdminAccessLevel.OWNER) {
  lastAdminSeq += 1;
  const dataSource = await getDataSource();
  const accounts = dataSource.getRepository<Account>("Account");
  const admins = dataSource.getRepository<Admin>("Admin");
  const email = `${accessLevel}.${lastAdminSeq}@test.com`;
  const account = await accounts.save(accounts.create({ email, passwordHash: "x" }));
  const admin = await admins.save(admins.create({ account, names: "Admin", lastnames: accessLevel, dni: null, accessLevel }));
  return { id: admin.id, email };
}

/**
 * Complejo del club en la base de test (el de menor id, como el que usa createCourt):
 * lo crea si todavía no hay ninguno.
 */
export async function ensureTestComplex() {
  const dataSource = await getDataSource();
  const complexes = dataSource.getRepository<Complex>("Complex");
  const [existing] = await complexes.find({ order: { id: "ASC" }, take: 1 });
  if (existing) return existing;
  return complexes.save(
    complexes.create({
      name: "Quento Club",
      address: "Cam. Centenario 8907",
      city: "Villa Elisa",
      province: "Buenos Aires",
      postalCode: "B1894",
      latitude: -34.863726,
      longitude: -58.061057,
      mapsUrl: "https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA",
    }),
  );
}

/**
 * Crea una cancha directo en la base para preparar un test (createCourt es solo
 * para el dueño), en el complejo del club. Devuelve lo mismo que createCourt.
 */
export async function createTestCourt(input: { number: number; price: number; state?: CourtState }) {
  const dataSource = await getDataSource();
  const courts = dataSource.getRepository<Court>("Court");
  const complex = await ensureTestComplex();
  const data = await courts.save(courts.create({ state: CourtState.AVAILABLE, complex, ...input }));
  return { success: true as const, data };
}
