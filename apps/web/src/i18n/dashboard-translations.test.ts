import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { dashboardTranslations } from "./dashboard-translations";
import { translate } from "./dictionaries";

const appRoot = resolve(import.meta.dir, "..");
const attrs = new Set([
	"placeholder",
	"title",
	"aria-label",
	"alt",
	"label",
	"emptyText",
]);
const technicalText = /^[0-9\s.,:;!?+*/=(){}<>\-–—·%]+$/;

test("dashboard copy has both translations and keeps interpolation placeholders", () => {
	const ptKeys = Object.keys(dashboardTranslations.pt).sort();
	expect(Object.keys(dashboardTranslations.es).sort()).toEqual(ptKeys);
	for (const key of ptKeys) {
		const placeholders = (s: string) =>
			[...s.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
		for (const locale of ["pt", "es"] as const) {
			expect(dashboardTranslations[locale][key].trim().length).toBeGreaterThan(
				0,
			);
			expect(placeholders(dashboardTranslations[locale][key])).toEqual(
				placeholders(key),
			);
		}
	}
	expect(translate("pt", "Move option {v0} down", { v0: 2 })).toBe(
		"Mover opção 2 para baixo",
	);
	expect(translate("es", "Move option {v0} down", { v0: 2 })).toBe(
		"Mover opción 2 hacia abajo",
	);
	// Unknown user-supplied text stays intact; only known interface copy is translated.
	expect(translate("pt", "Minha campanha exclusiva")).toBe(
		"Minha campanha exclusiva",
	);
});

test("dashboard routes and editor cannot introduce untranslated literal UI copy", () => {
	const missing: string[] = [];
	for (const dir of ["routes", "components"]) {
		for (const file of readdirSync(resolve(appRoot, dir))) {
			if (!file.endsWith(".tsx") || file.endsWith(".test.tsx")) continue;
			if (dir === "routes" && !file.startsWith("dashboard.")) continue;
			const source = readFileSync(resolve(appRoot, dir, file), "utf8");
			const ast = ts.createSourceFile(
				file,
				source,
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TSX,
			);
			function visit(n: ts.Node) {
				if (
					ts.isCallExpression(n) &&
					n.expression.getText(ast) === "panelT" &&
					ts.isStringLiteral(n.arguments[0])
				) {
					const key = n.arguments[0].text;
					if (
						!Object.hasOwn(dashboardTranslations.pt, key) ||
						!Object.hasOwn(dashboardTranslations.es, key)
					)
						missing.push(`${file}: missing translation: ${key}`);
				}
				if (ts.isJsxText(n)) {
					const text = n.text.trim();
					if (text && !technicalText.test(text) && /[A-Za-z]/.test(text))
						missing.push(`${file}: raw JSX: ${text}`);
				}
				if (
					ts.isJsxAttribute(n) &&
					attrs.has(n.name.getText(ast)) &&
					n.initializer &&
					ts.isStringLiteral(n.initializer) &&
					/[A-Za-z]/.test(n.initializer.text) &&
					!/^https?:\/\//.test(n.initializer.text)
				)
					missing.push(`${file}: raw attribute: ${n.initializer.text}`);
				ts.forEachChild(n, visit);
			}
			visit(ast);
		}
	}
	expect(missing).toEqual([]);
});
