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

export const INDEX = {
  interests: "interests",
  sessions: "sessions",
  zones: "zones",
  attendees: "attendees",
  plans: "plans",
  stints: "stints",
  tables: "tables",
  alerts: "alerts",
  notifications: "notifications",
  meta: "affinity-meta",
} as const;
