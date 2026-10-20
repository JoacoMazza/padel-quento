export async function register() {
  await import("reflect-metadata");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { applyClubTimeZone } = await import("@/src/lib/club-time-zone");
    applyClubTimeZone();

    const { startOpenMatchExpirationJob } = await import("@/src/jobs/open-match-expiration");
    startOpenMatchExpirationJob();

    const { startAttendancePointsJob } = await import("@/src/jobs/attendance-points");
    startAttendancePointsJob();

    const { startFixedBookingExtensionJob } = await import("@/src/jobs/fixed-booking-extension");
    startFixedBookingExtensionJob();
  }
}
