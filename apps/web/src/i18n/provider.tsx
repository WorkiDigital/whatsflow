import type { ReactNode } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { Locale } from "./dictionaries";
import {
	defaultLocale,
	isLocale,
	localeCookieName,
	resolveLocale,
	translate,
} from "./dictionaries";

type I18nContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function readLocaleCookie(): Locale {
	if (typeof document === "undefined") return defaultLocale;

	const raw = document.cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${localeCookieName}=`))
		?.split("=")[1];

	return isLocale(raw) ? raw : defaultLocale;
}

function persistLocale(locale: Locale) {
	if (typeof document === "undefined") return;

	document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
	if (typeof document.documentElement.lang !== "undefined") {
		document.documentElement.lang = locale;
	}
}

export function I18nProvider({
	children,
	initialLocale,
}: {
	children: ReactNode;
	initialLocale?: Locale;
}) {
	const [locale, setLocaleState] = useState<Locale>(
		initialLocale ? resolveLocale(initialLocale) : readLocaleCookie(),
	);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		persistLocale(next);
	}, []);

	const value = useMemo<I18nContextValue>(
		() => ({
			locale,
			setLocale,
			t: (key, values) => translate(locale, key, values),
		}),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const context = useContext(I18nContext);

	if (!context) {
		throw new Error("useI18n must be used inside an I18nProvider");
	}

	return context;
}

/** Convenience hook for components that only need the translator. */
export function useTranslation() {
	return useI18n().t;
}
