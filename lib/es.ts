import { Client } from "@elastic/elasticsearch";
import { config } from "./config";

let client: Client | undefined;

export function es(): Client {
  client ??= new Client({
    node: config.esUrl,
    auth: { username: config.esUsername, password: config.esPassword },
    requestTimeout: 30_000,
  });
  return client;
}

// A separate namespace lets local replay rehearsals share the ES service
// without replacing the live event's profiles or check-in history.
const prefix = process.env.ES_INDEX_PREFIX ?? "";
if (prefix && !/^[a-z][a-z0-9-]{0,48}-$/.test(prefix)) throw new Error("invalid ES_INDEX_PREFIX");
export const INDEX = {
  interests: `${prefix}interests`,
  sessions: `${prefix}sessions`,
  zones: `${prefix}zones`,
  attendees: `${prefix}attendees`,
  plans: `${prefix}plans`,
  stints: `${prefix}stints`,
  tables: `${prefix}tables`,
  alerts: `${prefix}alerts`,
  notifications: `${prefix}notifications`,
  meta: `${prefix}affinity-meta`,
} as const;
