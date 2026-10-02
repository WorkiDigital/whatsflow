import { mcpToken } from "@whatsapp-flow/db/schema/mcp";
import { env } from "@whatsapp-flow/env/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../index";
import { mcpEndpointUrl } from "../mcp-connection";
import { createMcpToken } from "../mcp-token";

export const mcpRouter = router({
	connection: protectedProcedure.query(async ({ ctx }) => {
		const [credential] = await ctx.db
			.select({ prefix: mcpToken.prefix, tokenHash: mcpToken.tokenHash })
			.from(mcpToken)
			.where(eq(mcpToken.userId, ctx.currentUser.id))
			.limit(1);
		return {
			url: mcpEndpointUrl(env.AUTH_URL),
			enabled: env.MCP_ENABLED === true,
			tokenConfigured: Boolean(credential?.tokenHash),
			prefix: credential?.tokenHash ? credential.prefix : null,
		};
	}),
	// Only the issuing response contains the secret; storage contains its hash.
	issueToken: protectedProcedure.mutation(async ({ ctx }) => {
		const { token, tokenHash, prefix } = createMcpToken();
		await ctx.db
			.insert(mcpToken)
			.values({ userId: ctx.currentUser.id, tokenHash, prefix })
			.onConflictDoUpdate({
				target: mcpToken.userId,
				set: { tokenHash, prefix, createdAt: new Date() },
			});
		return { token };
	}),
	revokeToken: protectedProcedure.mutation(async ({ ctx }) => {
		// A revoked row also prevents fallback to an old environment credential.
		await ctx.db
			.insert(mcpToken)
			.values({
				userId: ctx.currentUser.id,
				tokenHash: null,
				prefix: "revoked",
			})
			.onConflictDoUpdate({
				target: mcpToken.userId,
				set: { tokenHash: null, prefix: "revoked" },
			});
		return { revoked: true };
	}),
});
