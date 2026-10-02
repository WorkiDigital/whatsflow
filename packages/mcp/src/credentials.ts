import { createHash, timingSafeEqual } from "node:crypto";

import { createDb } from "@whatsapp-flow/db";
import { user } from "@whatsapp-flow/db/schema/auth";
import { mcpToken } from "@whatsapp-flow/db/schema/mcp";
import { env } from "@whatsapp-flow/env/server";
import { and, eq } from "drizzle-orm";

/**
 * Credentials issued in the panel are stored as hashes in mcp_token.
 * A managed row (including a revoked row) overrides legacy credentials.
 * For compatibility, MCP_TOKEN can still hold a JSON mapping userId -> secret:
 *
 *   MCP_TOKEN={"usr_123":"a-long-random-secret","usr_456":"another-secret"}
 *
 * One credential per user means access can be revoked for a single person
 * without rotating everyone else's, and the user id scopes every tool call to
 * that person's own permissions.
 */

export type McpCredential = { userId: string };

function constantTimeEquals(a: string, b: string) {
	const aBuffer = Buffer.from(a);
	const bBuffer = Buffer.from(b);
	if (aBuffer.length !== bBuffer.length) return false;
	return timingSafeEqual(aBuffer, bBuffer);
}

function parseCredentialMap(): Record<string, string> {
	const raw = env.MCP_TOKEN;
	if (!raw) return {};

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		const entries: Record<string, string> = {};
		for (const [userId, secret] of Object.entries(parsed)) {
			if (typeof secret === "string" && secret.length >= 32) {
				entries[userId] = secret;
			}
		}
		return entries;
	} catch {
		// A malformed value must never authenticate anyone.
		return {};
	}
}

export async function resolveMcpCredential(
	token: string,
	db = createDb(),
): Promise<McpCredential | null> {
	if (!token) return null;

	const tokenHash = createHash("sha256").update(token).digest("hex");
	const [managed] = await db
		.select({ userId: mcpToken.userId })
		.from(mcpToken)
		.innerJoin(user, eq(user.id, mcpToken.userId))
		.where(and(eq(mcpToken.tokenHash, tokenHash), eq(user.status, "active")))
		.limit(1);
	if (managed) return managed;
	if (token.startsWith("wfmcp_")) return null;
	const entries = parseCredentialMap();
	for (const [userId, secret] of Object.entries(entries)) {
		if (constantTimeEquals(token, secret)) {
			const [override] = await db
				.select({ userId: mcpToken.userId })
				.from(mcpToken)
				.where(eq(mcpToken.userId, userId))
				.limit(1);
			if (override) return null;
			const [account] = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.id, userId), eq(user.status, "active")))
				.limit(1);
			return account ? { userId } : null;
		}
	}

	return null;
}
