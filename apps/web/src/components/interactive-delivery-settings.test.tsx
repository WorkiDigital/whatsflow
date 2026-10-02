import { afterEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { useState } from "react";
import type { InteractiveNodeData } from "./flow-nodes";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
	url: "https://web.example.com",
	pretendToBeVisual: true,
});
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"MutationObserver",
	"getComputedStyle",
] as const) {
	Object.defineProperty(globalThis, key, {
		value: dom.window[key],
		configurable: true,
		writable: true,
	});
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
	value: true,
	configurable: true,
	writable: true,
});
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { I18nProvider, useI18n } = await import("../i18n/provider");
const { InteractiveDeliverySettings } = await import(
	"./interactive-delivery-settings"
);
afterEach(cleanup);

function Example({
	kind = "send-button",
}: {
	kind?: InteractiveNodeData["nodeType"];
}) {
	const [data, setData] = useState<InteractiveNodeData>({
		id: "node",
		nodeType: kind,
		category: "interactive",
		label: "Buttons",
		buttons: [{ id: "info", text: "Info" }],
	});
	const { setLocale } = useI18n();
	return (
		<>
			<button type="button" onClick={() => setLocale("es")}>
				Spanish
			</button>
			<button type="button" onClick={() => setLocale("en")}>
				English
			</button>
			<InteractiveDeliverySettings
				data={data}
				onUpdate={(patch) =>
					setData(
						(current) => ({ ...current, ...patch }) as InteractiveNodeData,
					)
				}
			/>
			<output data-testid="data">{JSON.stringify(data)}</output>
		</>
	);
}

test("editor persists mode, header and CTA without adding a reply branch", () => {
	const view = render(
		<I18nProvider initialLocale="pt">
			<Example />
		</I18nProvider>,
	);
	expect((view.getByRole("combobox") as HTMLSelectElement).value).toBe(
		"text_fallback",
	);
	fireEvent.change(view.getByRole("combobox"), {
		target: { value: "native_experimental" },
	});
	expect(view.getByRole("note").textContent).toContain(
		"BAILEYS_NATIVE_INTERACTIVE=true",
	);
	fireEvent.change(
		view.getByLabelText("URL da imagem de cabeçalho (opcional)"),
		{ target: { value: "https://example.com/image.jpg" } },
	);
	fireEvent.click(view.getByRole("button", { name: "Adicionar URL" }));
	fireEvent.change(view.getByLabelText("Texto do botão 1"), {
		target: { value: "Abrir" },
	});
	fireEvent.change(view.getByLabelText("URL 1"), {
		target: { value: "https://example.com" },
	});
	const data = JSON.parse(view.getByTestId("data").textContent ?? "{}");
	expect(data.deliveryMode).toBe("native_experimental");
	expect(data.headerImageUrl).toBe("https://example.com/image.jpg");
	expect(data.urlButtons).toEqual([
		{ text: "Abrir", url: "https://example.com" },
	]);
	expect(data.buttons).toEqual([{ id: "info", text: "Info" }]);
	fireEvent.click(view.getByRole("button", { name: "Spanish" }));
	expect(view.getByRole("combobox").textContent).toContain(
		"Texto numerado (compatible)",
	);
	fireEvent.click(view.getByRole("button", { name: "English" }));
	expect(view.getByRole("combobox").textContent).toContain(
		"Numbered text (compatible)",
	);
	expect(
		JSON.parse(view.getByTestId("data").textContent ?? "{}").urlButtons,
	).toHaveLength(1);
});

test("list settings expose delivery/header but not URL buttons", () => {
	const view = render(
		<I18nProvider initialLocale="en">
			<Example kind="send-list" />
		</I18nProvider>,
	);
	expect(view.queryByRole("button", { name: "Add URL" })).toBeNull();
	expect(view.getByLabelText("Header image URL (optional)")).toBeTruthy();
});
