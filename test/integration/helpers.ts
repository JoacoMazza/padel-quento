// Test files run serially against the same database, so each file starts from the current
// timestamp and increments: numbers never repeat within a file nor overlap with earlier files.
let lastCourtNumber = Date.now() % 1_000_000_000;

export function uniqueCourtNumber() {
  lastCourtNumber += 1;
  return lastCourtNumber;
}
