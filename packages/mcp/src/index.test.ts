import { describe, expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";
process.env.AUTH_SECRET ??= "x".repeat(32);
process.env.AUTH_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:3001";

const { mcpTools, listMcpTools } = await import("./index");

describe("MCP organization tools", () => {
	test("flow lookup and mutation carry the selected organization", async () => {
		const calls: unknown[] = [];
		const caller = {
			flow: {
				getById: async (input: unknown) => {
					calls.push(input);
					return null;
				},
				toggleStatus: async (input: unknown) => {
					calls.push(input);
					return null;
				},
			},
		};
		await mcpTools
			.find((tool) => tool.name === "get_flow")!
			.invoke(caller as never, {
				organizationId: "org-b",
				flowId: "flow-1",
			});
		await mcpTools
			.find((tool) => tool.name === "set_flow_status")!
			.invoke(caller as never, {
				organizationId: "org-b",
				flowId: "flow-1",
				status: "paused",
			});
		expect(calls).toEqual([
			{ tenantId: "org-b", id: "flow-1" },
			{ tenantId: "org-b", id: "flow-1", status: "paused" },
		]);
	});

	test("published schemas describe required arguments and status values", () => {
		const schema = listMcpTools().find(
			(tool) => tool.name === "set_flow_status",
		)!.inputSchema;
		expect(schema.required).toEqual(["organizationId", "flowId", "status"]);
		expect(
			(schema.properties as Record<string, { enum?: string[] }>).status.enum,
		).toEqual(["draft", "active", "paused"]);
	});

	test("an organization cannot be omitted and log limits are bounded", () => {
		const getFlow = mcpTools.find((tool) => tool.name === "get_flow")!;
		expect(() => getFlow.inputSchema.parse({ flowId: "flow-1" })).toThrow();
		const logs = mcpTools.find((tool) => tool.name === "list_flow_logs")!;
		expect(() =>
			logs.inputSchema.parse({ organizationId: "org-a", limit: 101 }),
		).toThrow();
	});
});
