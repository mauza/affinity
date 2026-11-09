// Pseudonymous identity: a random ID in an HttpOnly cookie. Ownership always
// comes from this cookie, never from a client-supplied ID.
import { cookies } from "next/headers";

const COOKIE = "aff_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function currentAttendeeId(): Promise<string | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && UUID.test(v) ? v : null;
}

/** Only call from route handlers or server actions (it may set a cookie). */
export async function ensureAttendeeId(): Promise<string> {
  const existing = await currentAttendeeId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 21,
  });
  return id;
}

export async function clearAttendeeCookie() {
  (await cookies()).delete(COOKIE);
}
