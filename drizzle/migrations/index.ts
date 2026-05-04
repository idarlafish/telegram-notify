import type { MigrationMeta } from "drizzle-orm/migrator";
import journal from "./meta/_journal.json";

const m0000 = `CREATE TABLE \`notifications\` (
\`id\` text PRIMARY KEY NOT NULL,
\`message\` text NOT NULL,
\`time\` text NOT NULL,
\`timezone\` text NOT NULL,
\`kind\` text NOT NULL,
\`weekdays\` integer,
\`next_fire_at\` integer NOT NULL,
\`last_sent_at\` integer,
\`created_at\` integer DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000) NOT NULL,
CONSTRAINT "recurring_has_weekdays" CHECK(("notifications"."kind"='recurring' AND "notifications"."weekdays" BETWEEN 1 AND 127)
       OR ("notifications"."kind"='one_time'  AND "notifications"."weekdays" IS NULL))
);
--> statement-breakpoint
CREATE INDEX \`idx_next_fire\` ON \`notifications\` (\`next_fire_at\`);`;

const migrations: { journal: typeof journal; migrations: Record<string, string> } = {
  journal,
  migrations: { m0000 },
};

export default migrations;
