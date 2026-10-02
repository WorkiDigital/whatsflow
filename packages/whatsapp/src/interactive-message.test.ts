import { afterEach, describe, expect, mock, test } from "bun:test";
import { proto } from "baileys";
import {
	buildNativeInteractiveContent,
	type InteractiveMessage,
	interactiveFallbackText,
	validateNativeInteractiveMessage,
} from "./interactive-message";
import { normalizeBaileysMessage } from "./message-content";
import { sendWhatsAppMessage } from "./message-sender";

const originalFlag = process.env.BAILEYS_NATIVE_INTERACTIVE;
afterEach(() => {
	if (originalFlag === undefined) delete process.env.BAILEYS_NATIVE_INTERACTIVE;
	else process.env.BAILEYS_NATIVE_INTERACTIVE = originalFlag;
});
const buttons: InteractiveMessage = {
	type: "interactive",
	kind: "buttons",
	deliveryMode: "native_experimental",
	body: "Olá!",
	footer: "Escolha uma opção",
	buttons: [
		{ id: "info", text: "Saber mais" },
		{ id: "stop", text: "Não receber mais" },
	],
	urlButtons: [{ text: "Toque aqui", url: "https://example.com/group" }],
};
const list: InteractiveMessage = {
	type: "interactive",
	kind: "list",
	deliveryMode: "native_experimental",
	body: "Escolha",
	buttonText: "Menu",
	sections: [
		{
			title: "Equipe",
			rows: [{ id: "sales", title: "Vendas", description: "Falar com vendas" }],
		},
	],
};

describe("experimental native interactive messages", () => {
	test("encodes CTA and quick replies with stable IDs and a media header", () => {
		validateNativeInteractiveMessage(buttons);
		const content = buildNativeInteractiveContent(buttons, {
			hasMediaAttachment: true,
			imageMessage: { url: "https://mmg.whatsapp.net/image" },
		});
		const decoded = proto.Message.decode(
			proto.Message.encode(content).finish(),
		);
		const interactive = decoded.viewOnceMessage?.message?.interactiveMessage;
		expect(interactive?.header?.hasMediaAttachment).toBe(true);
		expect(interactive?.body?.text).toBe("Olá!");
		const encodedButtons = interactive?.nativeFlowMessage?.buttons ?? [];
		expect(encodedButtons.map((b) => b.name)).toEqual([
			"cta_url",
			"quick_reply",
			"quick_reply",
		]);
		expect(JSON.parse(encodedButtons[1]?.buttonParamsJson ?? "{}")).toEqual({
			display_text: "Saber mais",
			id: "info",
		});
	});
	test("encodes a native list retaining row IDs", () => {
		validateNativeInteractiveMessage(list);
		const content = buildNativeInteractiveContent(list);
		const button =
			content.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage
				?.buttons?.[0];
		expect(button?.name).toBe("single_select");
		expect(
			JSON.parse(button?.buttonParamsJson ?? "{}").sections[0].rows[0].id,
		).toBe("sales");
	});
	test("is disabled by default without sending anything", async () => {
		delete process.env.BAILEYS_NATIVE_INTERACTIVE;
		const relayMessage = mock(() => Promise.resolve("id"));
		await expect(
			sendWhatsAppMessage(
				{ relayMessage } as never,
				"15551234567@s.whatsapp.net",
				buttons,
			),
		).rejects.toThrow("disabled");
		expect(relayMessage).not.toHaveBeenCalled();
	});
	test("relays once and returns a complete key for storage", async () => {
		process.env.BAILEYS_NATIVE_INTERACTIVE = "true";
		const relayMessage = mock(() => Promise.resolve("id"));
		const sendMessage = mock(() => Promise.resolve());
		const result = await sendWhatsAppMessage(
			{
				user: { id: "15550000000@s.whatsapp.net" },
				relayMessage,
				sendMessage,
			} as never,
			"15551234567@s.whatsapp.net",
			buttons,
		);
		expect(relayMessage).toHaveBeenCalledTimes(1);
		expect(result?.key.id).toBeTruthy();
		expect(result?.key.remoteJid).toBe("15551234567@s.whatsapp.net");
		expect(sendMessage).not.toHaveBeenCalled();
	});
	test("does not retry or switch to text after an ambiguous relay failure", async () => {
		process.env.BAILEYS_NATIVE_INTERACTIVE = "true";
		const relayMessage = mock(() => Promise.reject(new Error("relay failed")));
		const sendMessage = mock(() => Promise.resolve());
		await expect(
			sendWhatsAppMessage(
				{
					user: { id: "15550000000@s.whatsapp.net" },
					relayMessage,
					sendMessage,
				} as never,
				"15551234567@s.whatsapp.net",
				buttons,
			),
		).rejects.toThrow("relay failed");
		expect(relayMessage).toHaveBeenCalledTimes(1);
		expect(sendMessage).not.toHaveBeenCalled();
	});
	test("rejects groups, invalid URLs, duplicate IDs and excessive options", async () => {
		process.env.BAILEYS_NATIVE_INTERACTIVE = "true";
		await expect(
			sendWhatsAppMessage({} as never, "group@g.us", buttons),
		).rejects.toThrow("private chats");
		expect(() =>
			validateNativeInteractiveMessage({
				...buttons,
				urlButtons: [{ text: "Bad", url: "javascript:alert(1)" }],
			}),
		).toThrow("HTTP(S)");
		expect(() =>
			validateNativeInteractiveMessage({
				...buttons,
				buttons: [
					{ id: "x", text: "A" },
					{ id: "x", text: "B" },
				],
			}),
		).toThrow("unique");
		expect(() =>
			validateNativeInteractiveMessage({
				...buttons,
				buttons: [...buttons.buttons, { id: "x", text: "Extra" }],
			}),
		).toThrow("3 buttons");
		expect(() =>
			validateNativeInteractiveMessage({
				...list,
				sections: [{ title: "A", rows: [] }],
			}),
		).toThrow("1 to 10");
	});
	test("explicit text mode retains reply numbering, image links and CTA URLs", async () => {
		const message = {
			...buttons,
			deliveryMode: "text_fallback" as const,
			headerImageUrl: "https://example.com/header.jpg",
		};
		const text = interactiveFallbackText(message);
		expect(text).toContain("1. Saber mais\n2. Não receber mais");
		expect(text).toContain("Toque aqui: https://example.com/group");
		expect(text).toContain(message.headerImageUrl);
		const sendMessage = mock(() => Promise.resolve({ key: { id: "text" } }));
		await sendWhatsAppMessage(
			{ sendMessage } as never,
			"15551234567@s.whatsapp.net",
			message,
		);
		expect(sendMessage).toHaveBeenCalledWith("15551234567@s.whatsapp.net", {
			text,
		});
	});
	test("normalizes native quick reply and list selections", () => {
		for (const id of ["info", "sales"]) {
			const incoming = normalizeBaileysMessage({
				message: {
					interactiveResponseMessage: {
						body: { text: "Choice" },
						nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id }) },
					},
				},
			});
			expect(incoming.reply).toEqual({
				kind: "interactive",
				selectedId: id,
				selectedText: "Choice",
			});
		}
	});
});
