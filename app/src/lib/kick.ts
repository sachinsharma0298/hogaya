// Run a tick for a booking AFTER the response has been sent (so buttons answer instantly). On Vercel the function stays
// alive until the work is done, up to the route's maxDuration.
import { after } from "next/server";
import { tickAll, tickBooking } from "./engine";

export function kick(id: string) {
  after(async () => {
    await tickBooking(id).catch(() => {});
  });
}

export function kickAll() {
  after(async () => {
    await tickAll(40_000).catch(() => {});
  });
}
