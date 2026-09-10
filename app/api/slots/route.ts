import { getPublicSlots } from "@/lib/reservations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const slots = await getPublicSlots();
  return Response.json(
    { slots },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
