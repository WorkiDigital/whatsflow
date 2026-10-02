import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@whatsapp-flow/ui/components/dropdown-menu";
import { Check, Languages } from "lucide-react";

import {
	localeLabels,
	supportedLocales,
} from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/provider";

export function LanguageMenuItem() {
	const { locale, setLocale, t } = useI18n();

	return (
		<>
			<DropdownMenuSeparator />
			<DropdownMenuLabel className="flex items-center gap-2 text-xs">
				<Languages className="size-3.5" />
				{t("common.language")}
			</DropdownMenuLabel>
			{supportedLocales.map((value: Locale) => (
				<DropdownMenuItem
					key={value}
					onSelect={() => setLocale(value)}
					className="justify-between"
				>
					<span>{localeLabels[value]}</span>
					{value === locale ? (
						<Check className="size-3.5 text-primary" />
					) : null}
				</DropdownMenuItem>
			))}
		</>
	);
}

export default LanguageMenuItem;
