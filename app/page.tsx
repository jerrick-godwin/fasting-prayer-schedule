import { BookingExperience } from "@/components/booking-experience";
import { getPublicSlots } from "@/lib/calendly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const initialSlots = await getPublicSlots();

  return <BookingExperience initialSlots={initialSlots} />;
}
