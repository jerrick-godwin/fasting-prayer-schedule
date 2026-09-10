import type { PublicSlot } from "@/lib/slots";

type CalendarScheduleProps = {
  slots: PublicSlot[];
  onSelect: (slot: PublicSlot) => void;
};

type DayHeaderProps = {
  number: string;
  date: string;
};

function DayHeader({ number, date }: DayHeaderProps) {
  return (
    <div className="calendar-day-header">
      <span>Time</span>
      <div>
        <small>Day {number}</small>
        <strong>{date}</strong>
      </div>
    </div>
  );
}

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/London",
  hour: "numeric",
  hour12: true,
});

function hourMarkers(slot: PublicSlot) {
  const markers: { dateTime: string; label: string }[] = [];
  const end = Date.parse(slot.end);

  for (let current = Date.parse(slot.start); current < end; current += 60 * 60 * 1000) {
    const date = new Date(current);
    markers.push({
      dateTime: date.toISOString(),
      label: hourFormatter.format(date).replace(" ", ""),
    });
  }

  return markers;
}

function SlotRow({ slot, onSelect }: { slot: PublicSlot; onSelect: (slot: PublicSlot) => void }) {
  const booked = slot.status === "booked";
  const markers = hourMarkers(slot);

  return (
    <div className="calendar-row">
      <div
        className="calendar-row__guides"
        aria-hidden="true"
      >
        {markers.map((marker, index) => (
          <div
            className="calendar-row__guide"
            key={marker.dateTime}
            style={{ top: `${(index / markers.length) * 100}%` }}
          >
            <time dateTime={marker.dateTime}>{marker.label}</time>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`calendar-event calendar-event--${slot.tone}`}
        disabled={booked}
        onClick={() => onSelect(slot)}
        aria-label={`Slot ${slot.number}, ${slot.dayLabel} ${slot.dateLabel}, ${slot.timeLabel}, ${booked ? "booked" : "available"}`}
      >
        <span className="calendar-event__content">
          <span className="calendar-event__name">Slot {String(slot.number).padStart(2, "0")}</span>
          <strong>{slot.timeLabel}</strong>
        </span>
        <span className={`calendar-event__status ${booked ? "is-booked" : ""}`}>
          <i aria-hidden="true" />
          {booked ? "Booked" : "Available"}
        </span>
      </button>
    </div>
  );
}

export function CalendarSchedule({ slots, onSelect }: CalendarScheduleProps) {
  const fridaySlots = slots.slice(0, 5);
  const saturdaySlots = slots.slice(5);

  return (
    <div className="calendar-shell">
      <div className="calendar-toolbar">
        <div className="calendar-title">
          <span className="calendar-icon" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>24-hour Fasting Prayer Calendar</strong>
            <span>Friday morning through Saturday morning</span>
          </div>
        </div>
      </div>

      <DayHeader number="01" date="Friday, 18 September" />
      <div className="calendar-slot-list">
        {fridaySlots.map((slot) => <SlotRow key={slot.id} slot={slot} onSelect={onSelect} />)}
      </div>

      <DayHeader number="02" date="Saturday, 19 September" />
      <div className="calendar-slot-list">
        {saturdaySlots.map((slot) => <SlotRow key={slot.id} slot={slot} onSelect={onSelect} />)}
      </div>
    </div>
  );
}
