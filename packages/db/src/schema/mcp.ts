import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** One revocable credential per account. Plaintext tokens are never stored. */
export const mcpToken = pgTable("mcp_token", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").unique(),
	prefix: text("prefix").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
