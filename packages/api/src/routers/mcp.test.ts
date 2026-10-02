import { expect, test } from "bun:test";
import { user } from "@whatsapp-flow/db/schema/auth";
import { mcpToken } from "@whatsapp-flow/db/schema/mcp";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";
process.env.AUTH_SECRET ??= "x".repeat(32);
process.env.AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:3001";
const { mcpRouter } = await import("./mcp");

function setup(status = "active") {
	let stored: Record<string, unknown> | null = null;
	const db = {
		select: () => ({
			from: (table: unknown) => ({
				where: () => ({
					limit: async () =>
						table === user
							? [
									{
										id: "alice",
										email: "alice@example.com",
										role: "member",
										status,
									},
								]
							: stored
								? [stored]
								: [],
				}),
			}),
		}),
		insert: (table: unknown) => ({
			values: (values: Record<string, unknown>) => ({
				onConflictDoUpdate: async (options: {
					set: Record<string, unknown>;
				}) => {
					expect(table).toBe(mcpToken);
					stored = stored ? { ...stored, ...options.set } : values;
				},
			}),
		}),
	};
	const context = {
		session: { user: { id: "alice" }, session: { id: "session-1" } },
		db,
		auth: null,
		requestIp: null,
		requestUserAgent: null,
	};
	return {
		caller: mcpRouter.createCaller(context as never),
		getStored: () => stored,
	};
}

test("MCP panel requires sign-in", async () => {
	const caller = mcpRouter.createCaller({ session: null } as never);
	await expect(caller.connection()).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
	await expect(caller.issueToken()).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

test("issue, rotate and revoke always belong to the current account", async () => {
	const { caller, getStored } = setup();
	const first = await caller.issueToken();
	expect(getStored()?.userId).toBe("alice");
	expect(getStored()?.tokenHash).not.toBe(first.token);
	const metadata = await caller.connection();
	expect(metadata.tokenConfigured).toBe(true);
	expect(metadata).not.toHaveProperty("token");
	const firstHash = getStored()?.tokenHash;
	await caller.issueToken();
	expect(getStored()?.tokenHash).not.toBe(firstHash);
	await caller.revokeToken();
	expect(getStored()?.tokenHash).toBeNull();
	expect((await caller.connection()).tokenConfigured).toBe(false);
});

test("suspended accounts cannot issue a credential", async () => {
	await expect(setup("suspended").caller.issueToken()).rejects.toMatchObject({
		code: "FORBIDDEN",
	});
});
