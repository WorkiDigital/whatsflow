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
