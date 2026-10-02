import { expect, test } from "bun:test";
import { mcpEndpointUrl } from "./mcp-connection";

test("MCP panel uses the public API URL without duplicate slashes", () => {
	expect(mcpEndpointUrl("https://api.example.com/")).toBe(
		"https://api.example.com/mcp",
	);
});
