import { expect, test } from "bun:test";
import { createMcpToken, hashMcpToken } from "./mcp-token";

test("issued MCP tokens are unique and only their hashes are stored", () => {
	const first = createMcpToken();
	const second = createMcpToken();
	expect(first.token).not.toBe(second.token);
	expect(first.token.length).toBeGreaterThan(32);
	expect(first.tokenHash).toBe(hashMcpToken(first.token));
	expect(first.tokenHash).not.toContain(first.token);
	expect(first.prefix).toBe(first.token.slice(0, 14));
	expect(hashMcpToken(second.token)).not.toBe(first.tokenHash);
});
