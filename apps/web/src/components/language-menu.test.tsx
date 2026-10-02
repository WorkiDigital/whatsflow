import { afterEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

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
Object.defineProperty(globalThis, "requestAnimationFrame", {
	value: dom.window.requestAnimationFrame.bind(dom.window),
	configurable: true,
	writable: true,
});
Object.defineProperty(globalThis, "cancelAnimationFrame", {
	value: dom.window.cancelAnimationFrame.bind(dom.window),
	configurable: true,
	writable: true,
});
const { dashboardTranslations } = await import(
	"../i18n/dashboard-translations"
);
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger,
} = await import("@whatsapp-flow/ui/components/dropdown-menu");
const { I18nProvider, useI18n, readLocaleCookie } = await import(
	"../i18n/provider"
);
const { LanguageMenuItem } = await import("./language-menu");

function Example() {
	const { t } = useI18n();
	return (
		<>
			<p data-testid="translation">{t("common.language")}</p>
			<DropdownMenu open>
				<DropdownMenuTrigger>Profile</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuGroup>
						<LanguageMenuItem />
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}
afterEach(cleanup);

test("clicking a language updates translations and persists the choice", () => {
	const view = render(
		<I18nProvider initialLocale="en">
			<Example />
		</I18nProvider>,
	);
	fireEvent.click(view.getByRole("menuitem", { name: "Português" }));
	expect(view.getByTestId("translation").textContent).toBe("Idioma");
	expect(document.cookie).toContain("wf_locale=pt");
	expect(document.documentElement.lang).toBe("pt");
	fireEvent.click(view.getByRole("menuitem", { name: "Español" }));
	expect(view.getByTestId("translation").textContent).toBe("Idioma");
	expect(document.cookie).toContain("wf_locale=es");
	expect(document.documentElement.lang).toBe("es");
	expect(readLocaleCookie()).toBe("es");
	view.unmount();
	const restored = render(
		<I18nProvider initialLocale={readLocaleCookie()}>
			<Example />
		</I18nProvider>,
	);
	expect(restored.getByTestId("translation").textContent).toBe("Idioma");
});

// JSDOM does not implement blob worker URLs; the map itself is not mounted here.
Object.defineProperty(dom.window.URL, "createObjectURL", {
	value: () => "blob:test-worker",
	configurable: true,
});
const { NodeConfigPanel } = await import("./node-config-panel");
const { DataTable } = await import("./data-table");
const { paletteCategories, createNode, SendTextNode } = await import(
	"./flow-nodes"
);
const { ReactFlowProvider } = await import("@xyflow/react");

function DashboardExample() {
	const { t } = useI18n();
	const node = createNode("send-text");
	return (
		<>
			<Example />
			<DataTable
				columns={[
					{ key: "name", header: t("Name"), cell: () => "Sales workspace" },
				]}
				data={[{ id: "1" }]}
				getRowKey={(row) => row.id}
			/>
			<NodeConfigPanel
				node={node}
				flowId="test"
				canRotateWebhookToken={false}
				onUpdate={() => {}}
				onDelete={() => {}}
			/>
			<p>{t("No flows yet")}</p>
		</>
	);
}

test("language selection updates table headers, editor fields and empty states without changing customer data", () => {
	const view = render(
		<I18nProvider initialLocale="en">
			<DashboardExample />
		</I18nProvider>,
	);
	expect(view.getByRole("columnheader", { name: "Name" })).toBeTruthy();
	fireEvent.click(view.getByRole("menuitem", { name: "Português" }));
	expect(view.getByRole("columnheader", { name: "Nome" })).toBeTruthy();
	expect(view.getByText("Mensagem de texto")).toBeTruthy();
	expect(view.getByText("Nenhum fluxo ainda")).toBeTruthy();
	expect(view.getByText("Sales workspace")).toBeTruthy();
	fireEvent.click(view.getByRole("menuitem", { name: "Español" }));
	expect(view.getByRole("columnheader", { name: "Nombre" })).toBeTruthy();
	expect(view.getByText("Mensaje de texto")).toBeTruthy();
	expect(view.getByText("Todavía no hay flujos")).toBeTruthy();
	fireEvent.click(view.getByRole("menuitem", { name: "English" }));
	expect(view.getByRole("columnheader", { name: "Name" })).toBeTruthy();
	expect(view.getByText("No flows yet")).toBeTruthy();
});

test("every flow palette label translates and default labels leave saved/custom nodes intact", () => {
	for (const category of paletteCategories) {
		for (const text of [
			category.label,
			...category.items.map((item) => item.label),
		]) {
			for (const locale of ["pt", "es"] as const)
				expect(Object.hasOwn(dashboardTranslations[locale], text)).toBe(true);
		}
	}
	const node = createNode("send-text");
	const original = JSON.stringify(node);
	const props = {
		id: node.id,
		type: "send-text",
		data: node.data,
		selected: false,
		dragging: false,
		draggable: true,
		selectable: true,
		deletable: true,
		isConnectable: true,
		positionAbsoluteX: 0,
		positionAbsoluteY: 0,
		zIndex: 0,
	};
	const view = render(
		<I18nProvider initialLocale="pt">
			<ReactFlowProvider>
				<SendTextNode {...props} />
			</ReactFlowProvider>
		</I18nProvider>,
	);
	expect(view.getByText("Enviar texto")).toBeTruthy();
	expect(JSON.stringify(node)).toBe(original);
	view.rerender(
		<I18nProvider initialLocale="pt">
			<ReactFlowProvider>
				<SendTextNode
					{...props}
					data={{ ...node.data, label: "Sales workspace" }}
				/>
			</ReactFlowProvider>
		</I18nProvider>,
	);
	expect(view.getByText("Sales workspace")).toBeTruthy();
});
