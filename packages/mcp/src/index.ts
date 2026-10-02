import { createCaller, appRouter } from "@whatsapp-flow/api/routers/index";
import type { Context } from "@whatsapp-flow/api/context";
import { createDb } from "@whatsapp-flow/db";
import { env } from "@whatsapp-flow/env/server";
import { z } from "zod";

/**
 * Minimal MCP surface over the existing tRPC router.
 *
 * The router is deliberately not exposed wholesale: that would hand an AI
 * client every mutation the platform has, including tenant administration and
 * webhook token rotation. Instead a curated set of tools maps onto specific
 * procedures, so each call still passes through the same
 * `organizationPermissionProcedure` checks the web app uses. The MCP token
 * identifies a user; it never grants access beyond that user's own.
 */

type Caller = ReturnType<typeof createCaller<Context>>;

export type McpTool = {
	name: string;
	description: string;
	inputSchema: z.ZodTypeAny;
	readOnly: boolean;
	invoke: (caller: Caller, input: unknown) => Promise<unknown>;
};

const organizationId = z
	.string()
	.min(1)
	.describe("Organization id. Get it from list_my_organizations.");

function callerForUser(userId: string): Caller {
	const context = {
		auth: null,
		session: {
			user: { id: userId },
			session: { id: `mcp-${userId}`, userId },
		},
		db: createDb(),
		requestIp: null,
		requestUserAgent: "mcp",
	} as unknown as Context;

	return createCaller(appRouter, context);
}

export const mcpTools: McpTool[] = [
	{
		name: "list_my_organizations",
		description:
			"List the organizations the authenticated user belongs to. Start here: every other tool needs an organizationId.",
		inputSchema: z.object({}),
		readOnly: true,
		invoke: (caller) => caller.organization.listMine(),
	},
	{
		name: "list_flows",
		description:
			"List automation flows in an organization with status, trigger type and owning device.",
		inputSchema: z.object({ organizationId }),
		readOnly: true,
		invoke: (caller, input) => {
			const { organizationId: id } = z.object({ organizationId }).parse(input);
			return caller.flow.list({ tenantId: id });
		},
	},
	{
		name: "get_flow",
		description:
			"Get one flow by id, including its graph nodes. Use list_flows to discover ids.",
		inputSchema: z.object({ organizationId, flowId: z.string().min(1) }),
		readOnly: true,
		invoke: (caller, input) => {
			const { flowId } = z
				.object({ organizationId, flowId: z.string().min(1) })
				.parse(input);
			return caller.flow.getById({ id: flowId });
		},
	},
	{
		name: "set_flow_status",
		description:
			"Change a flow status. Use 'active' to start accepting traffic, 'paused' to stop it without discarding it, or 'draft' to move it out of the live state.",
		inputSchema: z.object({
			organizationId,
			flowId: z.string().min(1),
			status: z.enum(["draft", "active", "paused"]),
		}),
		readOnly: false,
		invoke: (caller, input) => {
			const { flowId, status } = z
				.object({
					organizationId,
					flowId: z.string().min(1),
					status: z.enum(["draft", "active", "paused"]),
				})
				.parse(input);
			return caller.flow.toggleStatus({ id: flowId, status });
		},
	},
	{
		name: "list_devices",
		description:
			"List WhatsApp devices connected to an organization, with connection status and last error.",
		inputSchema: z.object({ organizationId }),
		readOnly: true,
		invoke: (caller, input) => {
			const { organizationId: id } = z.object({ organizationId }).parse(input);
			return caller.device.list({ tenantId: id });
		},
	},
	{
		name: "list_flow_logs",
		description:
			"Read recent flow execution logs. Use this to diagnose why an automation is failing.",
		inputSchema: z.object({
			organizationId,
			flowId: z.string().optional(),
			deviceId: z.string().optional(),
			limit: z.number().int().min(1).max(100).default(20),
		}),
		readOnly: true,
		invoke: (caller, input) => {
			const { organizationId: id, flowId, deviceId, limit } = z
				.object({
					organizationId,
					flowId: z.string().optional(),
					deviceId: z.string().optional(),
					limit: z.number().int().min(1).max(100).default(20),
				})
				.parse(input);
			return caller.flowLog.list({ tenantId: id, flowId, deviceId, limit });
		},
	},
	{
		name: "list_organization_members",
		description: "List organization members and their assigned roles.",
		inputSchema: z.object({ organizationId }),
		readOnly: true,
		invoke: (caller, input) => {
			const { organizationId: id } = z.object({ organizationId }).parse(input);
			return caller.organization.listMembers({ tenantId: id });
		},
	},
	{
		name: "list_organization_roles",
		description:
			"List the system roles defined for an organization and their permissions.",
		inputSchema: z.object({ organizationId }),
		readOnly: true,
		invoke: (caller, input) => {
			const { organizationId: id } = z.object({ organizationId }).parse(input);
			return caller.organization.listRoles({ tenantId: id });
		},
	},
];

export function mcpEnabled() {
	return env.MCP_ENABLED === true;
}

export function mcpConfigured() {
	if (typeof env.MCP_TOKEN !== "string" || env.MCP_TOKEN.length < 32) {
		return false;
	}
	try {
		const parsed: unknown = JSON.parse(env.MCP_TOKEN);
		return Boolean(
			parsed &&
				typeof parsed === "object" &&
				!Array.isArray(parsed) &&
				Object.values(parsed).some(
					(secret) => typeof secret === "string" && secret.length >= 32,
				),
		);
	} catch {
		return false;
	}
}

/** Converts a zod schema into the JSON Schema shape MCP clients expect. */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const def = schema._def as {
		typeName?: string;
		innerType?: z.ZodTypeAny;
	};
	if (
		(def.typeName === "ZodOptional" || def.typeName === "ZodDefault") &&
		def.innerType
	) {
		return toJsonSchema(def.innerType);
	}
	return { type: "object", additionalProperties: true };
}

export function listMcpTools() {
	return mcpTools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		inputSchema: toJsonSchema(tool.inputSchema),
		readOnly: tool.readOnly,
	}));
}

export async function callMcpTool(userId: string, name: string, input: unknown) {
	const tool = mcpTools.find((candidate) => candidate.name === name);
	if (!tool) {
		throw new Error(`Unknown tool: ${name}`);
	}

	const parsed = tool.inputSchema.parse(input ?? {});
	const caller = callerForUser(userId);
	return tool.invoke(caller, parsed);
}
