export type SlotId = `slot-${number}`;
export type SlotTone =
  | "green"
  | "orange"
  | "blue"
  | "yellow"
  | "purple"
  | "sky"
  | "mint"
  | "pink"
  | "red";

export type SlotDefinition = {
  id: SlotId;
  number: number;
  dateLabel: string;
  dayLabel: string;
  timeLabel: string;
  start: string;
  end: string;
  duration: 120 | 180 | 235;
  tone: SlotTone;
};

export type PublicSlot = SlotDefinition & {
  status: "available" | "booked";
};

export const EVENT_TIMEZONE = "Europe/London";

export const slots: readonly SlotDefinition[] = [
  {
    id: "slot-1",
    number: 1,
    dateLabel: "18 September 2026",
    dayLabel: "Friday",
    timeLabel: "9:00 AM – 12:00 PM",
    start: "2026-09-18T08:00:00.000Z",
    end: "2026-09-18T11:00:00.000Z",
    duration: 180,
    tone: "green",
  },
  {
    id: "slot-2",
    number: 2,
    dateLabel: "18 September 2026",
    dayLabel: "Friday",
    timeLabel: "12:00 PM – 2:00 PM",
    start: "2026-09-18T11:00:00.000Z",
    end: "2026-09-18T13:00:00.000Z",
    duration: 120,
    tone: "orange",
  },
  {
    id: "slot-3",
    number: 3,
    dateLabel: "18 September 2026",
    dayLabel: "Friday",
    timeLabel: "2:00 PM – 5:00 PM",
    start: "2026-09-18T13:00:00.000Z",
    end: "2026-09-18T16:00:00.000Z",
    duration: 180,
    tone: "blue",
  },
  {
    id: "slot-4",
    number: 4,
    dateLabel: "18 September 2026",
    dayLabel: "Friday",
    timeLabel: "5:00 PM – 8:00 PM",
    start: "2026-09-18T16:00:00.000Z",
    end: "2026-09-18T19:00:00.000Z",
    duration: 180,
    tone: "yellow",
  },
  {
    id: "slot-5",
    number: 5,
    dateLabel: "18 September 2026",
    dayLabel: "Friday",
    timeLabel: "8:00 PM – 11:55 PM",
    start: "2026-09-18T19:00:00.000Z",
    end: "2026-09-18T22:55:00.000Z",
    duration: 235,
    tone: "purple",
  },
  {
    id: "slot-6",
    number: 6,
    dateLabel: "19 September 2026",
    dayLabel: "Saturday",
    timeLabel: "12:00 AM – 3:00 AM",
    start: "2026-09-18T23:00:00.000Z",
    end: "2026-09-19T02:00:00.000Z",
    duration: 180,
    tone: "sky",
  },
  {
    id: "slot-7",
    number: 7,
    dateLabel: "19 September 2026",
    dayLabel: "Saturday",
    timeLabel: "3:00 AM – 5:00 AM",
    start: "2026-09-19T02:00:00.000Z",
    end: "2026-09-19T04:00:00.000Z",
    duration: 120,
    tone: "mint",
  },
  {
    id: "slot-8",
    number: 8,
    dateLabel: "19 September 2026",
    dayLabel: "Saturday",
    timeLabel: "5:00 AM – 7:00 AM",
    start: "2026-09-19T04:00:00.000Z",
    end: "2026-09-19T06:00:00.000Z",
    duration: 120,
    tone: "pink",
  },
  {
    id: "slot-9",
    number: 9,
    dateLabel: "19 September 2026",
    dayLabel: "Saturday",
    timeLabel: "7:00 AM – 9:00 AM",
    start: "2026-09-19T06:00:00.000Z",
    end: "2026-09-19T08:00:00.000Z",
    duration: 120,
    tone: "red",
  },
] as const;

export function getSlot(slotId: string) {
  return slots.find((slot) => slot.id === slotId);
}

export function toPublicSlot(slot: SlotDefinition, available: boolean): PublicSlot {
  return { ...slot, status: available ? "available" : "booked" };
}
