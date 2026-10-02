import { getRequestHeader } from "@tanstack/react-start/server";
import type { Locale } from "../i18n/dictionaries";
import {
	isLocale,
	localeCookieName,
	negotiateLocale,
} from "../i18n/dictionaries";

/**
 * Resolves the locale for the initial server render: an explicit cookie choice
 * wins, otherwise the browser's Accept-Language header decides. Runs only on
 * the server; the client takes over from the cookie afterwards.
 */
export function getRequestLocale(): Locale {
	const cookieHeader = getRequestHeader("cookie");
	const fromCookie = cookieHeader
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${localeCookieName}=`))
		?.split("=")[1];

	if (isLocale(fromCookie)) return fromCookie;

	return negotiateLocale(getRequestHeader("accept-language"));
}
