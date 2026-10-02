import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";
process.env.AUTH_SECRET ??= "x".repeat(32);
process.env.AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:3001";
process.env.MCP_TOKEN = JSON.stringify({ alice: "legacy-secret-".repeat(4) });
const { resolveMcpCredential } = await import("./credentials");

function database(rows: unknown[][]) {
	let index = 0;
	const chain = {
		from: () => chain,
		innerJoin: () => chain,
		where: () => chain,
		limit: async () => rows[index++] ?? [],
	};
	return { select: () => chain } as never;
}

describe("managed MCP authentication", () => {
	test("resolves a managed credential to its owner", async () => {
		expect(
			await resolveMcpCredential(
				"wfmcp_secret",
				database([[{ userId: "alice" }]]),
			),
		).toEqual({ userId: "alice" });
	});
	test("rejects missing, rotated, revoked or suspended managed credentials", async () => {
		expect(
			await resolveMcpCredential("wfmcp_old_secret", database([[]])),
		).toBeNull();
		expect(await resolveMcpCredential("", database([]))).toBeNull();
	});
	test("a managed or revoked record blocks the legacy environment token", async () => {
		expect(
			await resolveMcpCredential(
				"legacy-secret-".repeat(4),
				database([[], [{ userId: "alice" }]]),
			),
		).toBeNull();
	});
	test("legacy credentials still require an active account", async () => {
		expect(
			await resolveMcpCredential(
				"legacy-secret-".repeat(4),
				database([[], [], []]),
			),
		).toBeNull();
	});
});
