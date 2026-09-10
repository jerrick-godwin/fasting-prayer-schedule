import { describe, expect, it } from "vitest";
import { getSlot, slots, toPublicSlot } from "./slots";

describe("prayer slot definitions", () => {
  it("contains nine unique slots", () => {
    expect(slots).toHaveLength(9);
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(9);
  });

  it("preserves the intentional five-minute gap before midnight", () => {
    const slot5 = getSlot("slot-5");
    const slot6 = getSlot("slot-6");
    expect(new Date(slot6!.start).getTime() - new Date(slot5!.end).getTime()).toBe(5 * 60 * 1000);
  });

  it("maps database occupancy to a public status", () => {
    expect(toPublicSlot(slots[0], true).status).toBe("available");
    expect(toPublicSlot(slots[0], false).status).toBe("booked");
  });

  it("maps UK BST boundaries to the expected UTC instants", () => {
    expect(getSlot("slot-1")?.start).toBe("2026-09-18T08:00:00.000Z");
    expect(getSlot("slot-9")?.end).toBe("2026-09-19T08:00:00.000Z");
  });
});
