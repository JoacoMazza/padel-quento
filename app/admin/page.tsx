import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getBookings } from "@/src/actions/booking";
import { getOutOfServices } from "@/src/actions/outOfService";
import { getPlayersAdmin } from "@/src/actions/player";
import { AdminPanel } from "@/app/admin/admin-panel";
import { mapBookingToAdminProp } from "@/app/admin/types";

export default async function AdminPage() {
  const [courtsResult, schedulesResult, bookingsResult, outOfServicesResult, playersResult] =
    await Promise.all([
      getCourts(),
      getSchedules(),
      getBookings(),
      getOutOfServices(),
      getPlayersAdmin(),
    ]);

  const courts = courtsResult.success ? courtsResult.data : [];
  const schedules = schedulesResult.success ? schedulesResult.data : [];
  const bookings = bookingsResult.success ? bookingsResult.data : [];
  const outOfServices = outOfServicesResult.success ? outOfServicesResult.data : [];
  const players = playersResult.success ? playersResult.data : [];

  return (
    <AdminPanel
      courts={courts.map((c) => ({ id: c.id, number: c.number, state: c.state, price: c.price }))}
      courtsError={!courtsResult.success ? courtsResult.error : null}
      schedules={schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        openingTime: String(s.openingTime),
        closingTime: String(s.closingTime),
        courtId: s.court?.id,
      }))}
      bookings={bookings.map(mapBookingToAdminProp)}
      outOfServices={outOfServices.map((o) => ({
        id: o.id,
        fromDateTime: o.fromDateTime,
        toDateTime: o.toDateTime,
        courtId: o.court?.id,
      }))}
      players={players}
    />
  );
}
