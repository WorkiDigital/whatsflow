import {
	generateWAMessageFromContent,
	prepareWAMessageMedia,
	proto,
	type WASocket,
} from "baileys";

export type InteractiveMessage = {
	type: "interactive";
	deliveryMode: "text_fallback" | "native_experimental";
	body: string;
	footer?: string;
	headerImageUrl?: string;
} & (
	| {
			kind: "buttons";
			buttons: { id: string; text: string }[];
			urlButtons?: { text: string; url: string }[];
	  }
	| {
			kind: "list";
			buttonText: string;
			sections: {
				title: string;
				rows: { id: string; title: string; description?: string }[];
			}[];
	  }
);

function bounded(
	value: string,
	max: number,
	label: string,
	allowTemplates = false,
) {
	const rendered = allowTemplates
		? value?.replace(/\{\{[^}]+\}\}/g, "x")
		: value;
	if (!rendered?.trim() || rendered.length > max) {
		throw new Error(`${label} must have between 1 and ${max} characters`);
	}
}

function httpUrl(value: string, allowTemplates = false) {
	const candidate = allowTemplates
		? value
				.replace(/^\{\{[^}]+\}\}$/, "https://example.invalid")
				.replace(/\{\{[^}]+\}\}/g, "x")
		: value;
	const url = new URL(candidate);
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password
	) {
		throw new Error("Interactive URLs must use HTTP(S) without credentials");
	}
}

/** Conservative limits for the experimental transport, not a delivery guarantee. */
export function validateNativeInteractiveMessage(
	message: InteractiveMessage,
	{ allowTemplates = false } = {},
) {
	const label = (value: string, max: number, name: string) =>
		bounded(value, max, name, allowTemplates);
	label(message.body, 1024, "Message body");
	if (message.footer) label(message.footer, 60, "Footer");
	if (message.headerImageUrl) httpUrl(message.headerImageUrl, allowTemplates);
	const ids = new Set<string>();
	const validateOption = (id: string, text: string) => {
		bounded(id, 200, "Option ID");
		if (id !== id.trim() || ids.has(id)) {
			throw new Error("Interactive option IDs must be trimmed and unique");
		}
		ids.add(id);
		label(text, 24, "Option label");
	};
	if (message.kind === "buttons") {
		const count = message.buttons.length + (message.urlButtons?.length ?? 0);
		if (!message.buttons.length || count > 3) {
			throw new Error(
				"Native buttons need a reply option and at most 3 buttons total",
			);
		}
		for (const button of message.buttons)
			validateOption(button.id, button.text);
		for (const button of message.urlButtons ?? []) {
			label(button.text, 24, "URL button label");
			httpUrl(button.url, allowTemplates);
		}
	} else {
		label(message.buttonText, 20, "List button label");
		const rows = message.sections.flatMap((section) => section.rows);
		if (
			!rows.length ||
			rows.length > 10 ||
			message.sections.some((s) => !s.rows.length)
		) {
			throw new Error("Native lists need 1 to 10 rows and no empty sections");
		}
		for (const section of message.sections) {
			label(section.title, 24, "Section title");
			for (const row of section.rows) {
				validateOption(row.id, row.title);
				if (row.description) label(row.description, 72, "Row description");
			}
		}
	}
}

export function interactiveFallbackText(message: InteractiveMessage) {
	const lines = [message.body];
	if (message.headerImageUrl) lines.push(message.headerImageUrl);
	if (message.kind === "buttons") {
		lines.push(
			...message.buttons.map((button, i) => `${i + 1}. ${button.text}`),
		);
		lines.push(
			...(message.urlButtons ?? []).map(
				(button) => `${button.text}: ${button.url}`,
			),
		);
	} else {
		let index = 1;
		for (const section of message.sections) {
			if (section.title) lines.push(`\n*${section.title}*`);
			for (const row of section.rows) {
				lines.push(
					`${index++}. ${row.title}${row.description ? ` — ${row.description}` : ""}`,
				);
			}
		}
	}
	if (message.footer) lines.push(message.footer);
	return lines.filter(Boolean).join("\n");
}

/** Raw protobuf transport: opt-in only; unsupported WhatsApp clients may not render it. */
export async function sendNativeInteractiveMessage(
	socket: WASocket,
	jid: string,
	message: InteractiveMessage,
) {
	if (process.env.BAILEYS_NATIVE_INTERACTIVE !== "true") {
		throw new Error(
			"Experimental native messages are disabled. Set BAILEYS_NATIVE_INTERACTIVE=true on the API, or choose text mode.",
		);
	}
	if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) {
		throw new Error(
			"Experimental native messages are limited to private chats",
		);
	}
	validateNativeInteractiveMessage(message);
	if (!socket.user?.id) throw new Error("Device is not connected");
	const header: proto.Message.InteractiveMessage.IHeader = {
		hasMediaAttachment: false,
	};
	if (message.headerImageUrl) {
		const media = await prepareWAMessageMedia(
			{ image: { url: message.headerImageUrl } },
			{ upload: socket.waUploadToServer },
		);
		header.imageMessage = media.imageMessage;
		header.hasMediaAttachment = true;
	}
	const content = buildNativeInteractiveContent(message, header);
	const sent = generateWAMessageFromContent(jid, content, {
		userJid: socket.user.id,
	});
	// Do not retry as text after a relay failure: delivery could have already happened.
	if (!sent.message || !sent.key.id)
		throw new Error("Could not build native message");
	await socket.relayMessage(jid, sent.message, { messageId: sent.key.id });
	return sent;
}

export function buildNativeInteractiveContent(
	message: InteractiveMessage,
	header: proto.Message.InteractiveMessage.IHeader = {
		hasMediaAttachment: false,
	},
) {
	const buttons =
		message.kind === "buttons"
			? [
					...(message.urlButtons ?? []).map((button) => ({
						name: "cta_url",
						buttonParamsJson: JSON.stringify({
							display_text: button.text,
							url: button.url,
						}),
					})),
					...message.buttons.map((button) => ({
						name: "quick_reply",
						buttonParamsJson: JSON.stringify({
							display_text: button.text,
							id: button.id,
						}),
					})),
				]
			: [
					{
						name: "single_select",
						buttonParamsJson: JSON.stringify({
							title: message.buttonText,
							sections: message.sections,
						}),
					},
				];
	return proto.Message.create({
		viewOnceMessage: {
			message: {
				messageContextInfo: {
					deviceListMetadata: {},
					deviceListMetadataVersion: 2,
				},
				interactiveMessage: {
					header,
					body: { text: message.body },
					...(message.footer ? { footer: { text: message.footer } } : {}),
					nativeFlowMessage: { buttons, messageVersion: 1 },
				},
			},
		},
	});
}
