export type Interest = { id: string; label: string; isNew?: boolean };
export type Profile = {
  display_name?: string;
  public_name?: boolean;
  newcomer?: boolean;
  interests: string[];
  public_interests: string[];
  interestLabels?: Record<string, string>;
};
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const value = await r.json();
  if (!r.ok)
    throw new Error(value.error || "Something went wrong. Please try again.");
  return value;
}
export const time = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const count = (n: number) => (n > 0 && n < 3 ? "a few" : String(n));
