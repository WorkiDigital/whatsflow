import {
	type InteractiveMessage,
	validateNativeInteractiveMessage,
} from "@whatsapp-flow/whatsapp/interactive-message";

/** CTA links are separate from reply options: opening a URL cannot resume a flow. */
export function buildInteractiveMessage(
	node: { type: string; data: Record<string, unknown> },
	resolve: (text: string) => string = (text) => text,
	validationOptions: { allowTemplates?: boolean } = {},
): InteractiveMessage {
	const data = node.data;
	if (
		data.deliveryMode !== undefined &&
		data.deliveryMode !== "text_fallback" &&
		data.deliveryMode !== "native_experimental"
	) {
		throw new Error("Unknown interactive delivery mode");
	}
	const base = {
		type: "interactive" as const,
		deliveryMode: (data.deliveryMode ??
			"text_fallback") as InteractiveMessage["deliveryMode"],
		body: resolve(String(data.bodyText ?? "")),
		footer: data.footerText ? resolve(String(data.footerText)) : undefined,
		headerImageUrl: data.headerImageUrl
			? resolve(String(data.headerImageUrl))
			: undefined,
	};
	const message: InteractiveMessage =
		node.type === "send-list"
			? {
					...base,
					kind: "list",
					buttonText: resolve(String(data.buttonText || "Menu")),
					sections: (
						(data.sections ?? []) as Extract<
							InteractiveMessage,
							{ kind: "list" }
						>["sections"]
					).map((section) => ({
						title: resolve(String(section.title ?? "")),
						rows: section.rows.map((row) => ({
							...row,
							title: resolve(String(row.title ?? "")),
							description: row.description
								? resolve(row.description)
								: undefined,
						})),
					})),
				}
			: {
					...base,
					kind: "buttons",
					buttons: ((data.buttons ?? []) as { id: string; text: string }[]).map(
						(button) => ({
							id: button.id,
							text: resolve(String(button.text ?? "")),
						}),
					),
					urlButtons: (
						(data.urlButtons ?? []) as { text: string; url: string }[]
					).map((button) => ({
						text: resolve(String(button.text ?? "")),
						url: resolve(String(button.url ?? "")),
					})),
				};
	if (message.deliveryMode === "native_experimental")
		validateNativeInteractiveMessage(message, validationOptions);
	return message;
}
