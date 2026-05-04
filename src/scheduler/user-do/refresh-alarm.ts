import { sql } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { notifications } from "./schema";

type Schema = { notifications: typeof notifications };

export async function refreshAlarm(
  db: DrizzleSqliteDODatabase<Schema>,
  storage: DurableObjectStorage,
): Promise<void> {
  const [row] = await db
    .select({ min: sql<number | null>`MIN(${notifications.next_fire_at})` })
    .from(notifications);
  if (row?.min == null) {
    await storage.deleteAlarm();
  } else {
    await storage.setAlarm(row.min);
  }
}
