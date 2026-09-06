"use client";

import { useMemo, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { BookingRow } from "@/app/my-bookings/booking-row";
import { FiltersPanel } from "@/app/my-bookings/filters-panel";
import { getBookingEnd, matchesDateFilter, matchesStatusFilter, getBookingTone } from "@/app/my-bookings/booking-status";
import type { DateFilter, MyBookingItem, StatusFilter } from "@/app/my-bookings/types";

export function MyBookingsBoard({
  userName,
  userEmail,
  bookings,
}: {
  userName?: string | null;
  userEmail?: string | null;
  bookings: MyBookingItem[];
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const now = new Date();

  const { upcoming, past, upcomingCount, pastCount } = useMemo(() => {
    const upcomingAll = bookings.filter((b) => getBookingEnd(b) >= now);
    const pastAll = bookings.filter((b) => getBookingEnd(b) < now);

    const applyFilters = (items: MyBookingItem[]) =>
      items.filter(
        (b) =>
          matchesDateFilter(b.fromDateTime, now, dateFilter) &&
          matchesStatusFilter(getBookingTone(b, now), statusFilter),
      );

    return {
      upcoming: applyFilters(upcomingAll).sort((a, b) => a.fromDateTime.getTime() - b.fromDateTime.getTime()),
      past: applyFilters(pastAll).sort((a, b) => b.fromDateTime.getTime() - a.fromDateTime.getTime()),
      upcomingCount: upcomingAll.length,
      pastCount: pastAll.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, dateFilter, statusFilter]);

  function handleClear() {
    setDateFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <section>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            Próximos turnos
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-foreground/50">No tenés turnos próximos con estos filtros.</p>
            ) : (
              upcoming.map((booking) => <BookingRow key={booking.id} booking={booking} now={now} />)
            )}
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground">
            <Clock className="h-5 w-5 text-foreground/50" />
            Turnos anteriores
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {past.length === 0 ? (
              <p className="text-sm text-foreground/50">No tenés turnos anteriores con estos filtros.</p>
            ) : (
              past.map((booking) => <BookingRow key={booking.id} booking={booking} now={now} />)
            )}
          </div>
        </section>
      </div>

      <FiltersPanel
        userName={userName}
        userEmail={userEmail}
        upcomingCount={upcomingCount}
        pastCount={pastCount}
        dateFilter={dateFilter}
        statusFilter={statusFilter}
        onDateFilterChange={setDateFilter}
        onStatusFilterChange={setStatusFilter}
        onClear={handleClear}
      />
    </div>
  );
}
