import { createHash, randomBytes } from "node:crypto";
export function hashMcpToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
export function createMcpToken() {
	const token = `wfmcp_${randomBytes(32).toString("base64url")}`;
	return { token, tokenHash: hashMcpToken(token), prefix: token.slice(0, 14) };
}
