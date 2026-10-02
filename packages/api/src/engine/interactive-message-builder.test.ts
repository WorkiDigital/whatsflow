import { expect, test } from "bun:test";
import { buildInteractiveMessage } from "./interactive-message-builder";

test("legacy nodes default to text; CTA links do not become reply options", () => {
	const message = buildInteractiveMessage({
		type: "send-button",
		data: {
			bodyText: "Olá",
			buttons: [{ id: "info", text: "Saber mais" }],
			urlButtons: [{ text: "Toque aqui", url: "https://example.com" }],
		},
	});
	expect(message.deliveryMode).toBe("text_fallback");
	if (message.kind !== "buttons") throw new Error("Expected buttons");
	expect(message.buttons).toEqual([{ id: "info", text: "Saber mais" }]);
	expect(message.urlButtons).toHaveLength(1);
});

test("resolves body, labels, header and CTA URLs without rewriting option IDs", () => {
	const message = buildInteractiveMessage(
		{
			type: "send-button",
			data: {
				deliveryMode: "native_experimental",
				bodyText: "Olá {{name}}",
				headerImageUrl: "{{image}}",
				buttons: [{ id: "sales", text: "{{label}}" }],
				urlButtons: [{ text: "Abrir", url: "{{url}}" }],
			},
		},
		(value) =>
			value
				.replace("{{name}}", "Ana")
				.replace("{{image}}", "https://example.com/header.jpg")
				.replace("{{label}}", "Vendas")
				.replace("{{url}}", "https://example.com"),
	);
	expect(message.body).toBe("Olá Ana");
	expect(message.headerImageUrl).toBe("https://example.com/header.jpg");
	if (message.kind !== "buttons") throw new Error("Expected buttons");
	expect(message.buttons).toEqual([{ id: "sales", text: "Vendas" }]);
	expect(message.urlButtons?.[0]?.url).toBe("https://example.com");
});

test("validates actual resolved values and rejects unknown delivery modes", () => {
	expect(() =>
		buildInteractiveMessage(
			{
				type: "send-button",
				data: {
					deliveryMode: "native_experimental",
					bodyText: "Hi",
					buttons: [{ id: "x", text: "{{long}}" }],
				},
			},
			(value) => value.replace("{{long}}", "x".repeat(25)),
		),
	).toThrow("Option label");
	expect(() =>
		buildInteractiveMessage({
			type: "send-button",
			data: { deliveryMode: "automatic" },
		}),
	).toThrow("Unknown");
});

test("static validation allows dynamic labels and URLs but never relaxes ID uniqueness", () => {
	const node = {
		type: "send-button",
		data: {
			deliveryMode: "native_experimental",
			bodyText: "Hi",
			buttons: [{ id: "reply", text: "{{first}} {{last}}" }],
			urlButtons: [{ text: "Open", url: "{{url}}" }],
		},
	};
	expect(
		buildInteractiveMessage(node, (text) => text, { allowTemplates: true })
			.deliveryMode,
	).toBe("native_experimental");
	expect(() =>
		buildInteractiveMessage(
			{
				...node,
				data: {
					...node.data,
					buttons: [
						{ id: "x", text: "{{first}}" },
						{ id: "x", text: "{{last}}" },
					],
				},
			},
			(text) => text,
			{ allowTemplates: true },
		),
	).toThrow("unique");
});
