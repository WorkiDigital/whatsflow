import { env } from "@whatsapp-flow/env/server";
import { callMcpTool, listMcpTools, mcpConfigured, mcpEnabled } from "./index";

/**
 * JSON-RPC 2.0 transport for the MCP tools, shaped so an MCP client (Claude
 * Desktop, an agent runtime, or any stdio/HTTP bridge) can call them. The
 * server intentionally supports the read-only half of the protocol here;
 * full MCP initialization and resource support belong to the SDK when it is
 * introduced.
 */

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcRequest = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
};

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string };
};

function errorResponse(
	id: string | number | null,
	code: number,
	message: string,
): JsonRpcResponse {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

function okResponse(
	id: string | number | null,
	result: unknown,
): JsonRpcResponse {
	return { jsonrpc: "2.0", id, result };
}

export async function handleJsonRpc(
	request: JsonRpcRequest,
	userId: string,
): Promise<JsonRpcResponse> {
	const id = request.id ?? null;

	if (!mcpEnabled()) {
		return errorResponse(id, -32000, "MCP server is disabled");
	}

	if (!mcpConfigured()) {
		return errorResponse(
			id,
			-32000,
			"MCP_TOKEN is not configured or is shorter than 32 characters",
		);
	}

	switch (request.method) {
		case "initialize":
			return okResponse(id, {
				protocolVersion: PROTOCOL_VERSION,
				serverInfo: { name: "whatsapp-flow", version: "0.1.0" },
				capabilities: { tools: { listChanged: false } },
			});

		case "tools/list":
			return okResponse(id, { tools: listMcpTools() });

		case "tools/call": {
			const name = request.params?.name;
			if (typeof name !== "string") {
				return errorResponse(id, -32602, "Missing tool name");
			}
			const args = (request.params?.arguments ?? {}) as unknown;
			try {
				const result = await callMcpTool(userId, name, args);
				return okResponse(id, {
					content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
					isError: false,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Tool call failed";
				// The tool ran but the operation was refused, for example by the
				// organization permission check. Report it as a tool-level error
				// so the model can read the reason instead of a transport fault.
				return okResponse(id, {
					content: [{ type: "text", text: message }],
					isError: true,
				});
			}
		}

		case "ping":
			return okResponse(id, {});

		default:
			return errorResponse(id, -32601, `Method not found: ${request.method}`);
	}
}

export function mcpStatus() {
	return {
		enabled: mcpEnabled(),
		configured: mcpConfigured(),
		toolCount: listMcpTools().length,
		envVar: env.MCP_TOKEN ? "MCP_TOKEN (set)" : "MCP_TOKEN (missing)",
	};
}
