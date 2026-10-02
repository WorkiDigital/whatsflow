export function mcpEndpointUrl(apiUrl: string) {
	return `${apiUrl.replace(/\/$/, "")}/mcp`;
}
