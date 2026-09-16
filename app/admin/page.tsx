import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getBookings } from "@/src/actions/booking";
import { getOutOfServices } from "@/src/actions/outOfService";
import { AdminPanel } from "@/app/admin/admin-panel";

export default async function AdminPage() {
  const [courtsResult, schedulesResult, bookingsResult, outOfServicesResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getBookings(),
    getOutOfServices(),
  ]);

  const courts = courtsResult.success ? courtsResult.data : [];
  const schedules = schedulesResult.success ? schedulesResult.data : [];
  const bookings = bookingsResult.success ? bookingsResult.data : [];
  const outOfServices = outOfServicesResult.success ? outOfServicesResult.data : [];

  return (
    <AdminPanel
      courts={courts.map((c) => ({ id: c.id, number: c.number, state: c.state }))}
      courtsError={!courtsResult.success ? courtsResult.error : null}
      schedules={schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        openingTime: String(s.openingTime),
        closingTime: String(s.closingTime),
        courtId: s.court?.id,
      }))}
      bookings={bookings.map((b) => ({
        id: b.id,
        fromDateTime: b.fromDateTime,
        durationMinutes: b.durationMinutes,
        bookingState: b.bookingState,
        needPlayers: b.match?.needPlayers ?? false,
        courtId: b.court?.id,
        confirmedPlayers: (b.match?.matchPlayers ?? []).reduce(
          (sum, mp) => sum + (mp.playersCount ?? 1),
          0,
        ),
      }))}
      outOfServices={outOfServices.map((o) => ({
        id: o.id,
        fromDateTime: o.fromDateTime,
        toDateTime: o.toDateTime,
        courtId: o.court?.id,
      }))}
    />
  );
}
