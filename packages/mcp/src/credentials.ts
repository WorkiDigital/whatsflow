import { timingSafeEqual } from "node:crypto";

import { env } from "@whatsapp-flow/env/server";

/**
 * MCP_TOKEN holds a JSON object mapping userId -> secret:
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

export function resolveMcpCredential(token: string): McpCredential | null {
	if (!token) return null;

	const entries = parseCredentialMap();
	for (const [userId, secret] of Object.entries(entries)) {
		if (constantTimeEquals(token, secret)) {
			return { userId };
		}
	}

	return null;
}
