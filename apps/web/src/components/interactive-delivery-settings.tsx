import { Button } from "@whatsapp-flow/ui/components/button";
import { Input } from "@whatsapp-flow/ui/components/input";
import { useId } from "react";
import { useI18n } from "@/i18n/provider";
import type { FlowNodeData, InteractiveNodeData } from "./flow-nodes";

const copy = {
	pt: {
		mode: "Modo de envio",
		listLabel: "Texto do botão da lista",
		text: "Texto numerado (compatível)",
		native: "Nativo Baileys (experimental)",
		warning:
			"Experimental: exige BAILEYS_NATIVE_INTERACTIVE=true na API e conversa privada. A entrega e a exibição dependem do WhatsApp; teste em um celular antes de usar. Não é um template aprovado da Meta.",
		image: "URL da imagem de cabeçalho (opcional)",
		urls: "Botões de URL",
		add: "Adicionar URL",
		label: "Texto do botão",
		remove: "Remover URL",
		note: "O link não gera resposta nem ramificação. No modo texto, imagem e URLs aparecem como links. No nativo: até 3 botões no total; listas de até 10 linhas.",
	},
	en: {
		mode: "Delivery mode",
		listLabel: "List button label",
		text: "Numbered text (compatible)",
		native: "Native Baileys (experimental)",
		warning:
			"Experimental: requires BAILEYS_NATIVE_INTERACTIVE=true on the API and a private chat. Delivery and rendering depend on WhatsApp; test on a phone first. This is not a Meta-approved template.",
		image: "Header image URL (optional)",
		urls: "URL buttons",
		add: "Add URL",
		label: "Button label",
		remove: "Remove URL",
		note: "A link does not produce a reply or branch. In text mode, images and URLs appear as links. Native: up to 3 buttons total; lists up to 10 rows.",
	},
	es: {
		mode: "Modo de envío",
		listLabel: "Texto del botón de la lista",
		text: "Texto numerado (compatible)",
		native: "Nativo Baileys (experimental)",
		warning:
			"Experimental: requiere BAILEYS_NATIVE_INTERACTIVE=true en la API y un chat privado. La entrega y visualización dependen de WhatsApp; prueba en un móvil primero. No es una plantilla aprobada por Meta.",
		image: "URL de la imagen de cabecera (opcional)",
		urls: "Botones de URL",
		add: "Añadir URL",
		label: "Texto del botón",
		remove: "Eliminar URL",
		note: "El enlace no genera respuesta ni rama. En modo texto, imagen y URLs aparecen como enlaces. Nativo: hasta 3 botones en total; listas de hasta 10 filas.",
	},
};

export function InteractiveDeliverySettings({
	data,
	onUpdate,
}: {
	data: InteractiveNodeData;
	onUpdate: (data: Partial<FlowNodeData>) => void;
}) {
	const { locale } = useI18n();
	const imageId = useId();
	const listId = useId();
	const t = copy[locale];
	const urls = data.urlButtons ?? [];
	const native = data.deliveryMode === "native_experimental";
	return (
		<div className="flex flex-col gap-2 rounded-md border p-2 text-[10px]">
			<label className="flex flex-col gap-1">
				{t.mode}
				<select
					className="h-7 rounded-md border bg-background px-1 text-xs"
					value={data.deliveryMode ?? "text_fallback"}
					onChange={(event) =>
						onUpdate({
							deliveryMode: event.target
								.value as InteractiveNodeData["deliveryMode"],
						})
					}
				>
					<option value="text_fallback">{t.text}</option>
					<option value="native_experimental">{t.native}</option>
				</select>
			</label>
			{native && (
				<p role="note" className="text-amber-600 dark:text-amber-400">
					{t.warning}
				</p>
			)}
			<label className="flex flex-col gap-1" htmlFor={imageId}>
				{t.image}
				<Input
					id={imageId}
					className="h-7 text-xs"
					placeholder="https://…"
					value={data.headerImageUrl ?? ""}
					onChange={(event) => onUpdate({ headerImageUrl: event.target.value })}
				/>
			</label>
			{data.nodeType !== "send-list" && (
				<div className="flex flex-col gap-1">
					<span>{t.urls}</span>
					{urls.map((button, index) => (
						<div key={index} className="flex flex-col gap-1 border-l pl-2">
							<Input
								aria-label={`${t.label} ${index + 1}`}
								placeholder={t.label}
								className="h-7 text-xs"
								value={button.text}
								onChange={(event) =>
									onUpdate({
										urlButtons: urls.map((b, i) =>
											i === index ? { ...b, text: event.target.value } : b,
										),
									})
								}
							/>
							<Input
								aria-label={`URL ${index + 1}`}
								placeholder="https://…"
								className="h-7 text-xs"
								value={button.url}
								onChange={(event) =>
									onUpdate({
										urlButtons: urls.map((b, i) =>
											i === index ? { ...b, url: event.target.value } : b,
										),
									})
								}
							/>
							<Button
								size="xs"
								variant="ghost"
								onClick={() =>
									onUpdate({ urlButtons: urls.filter((_, i) => i !== index) })
								}
							>
								{t.remove}
							</Button>
						</div>
					))}
					<Button
						size="xs"
						variant="outline"
						disabled={urls.length + (data.buttons?.length ?? 0) >= 3}
						onClick={() =>
							onUpdate({ urlButtons: [...urls, { text: "", url: "" }] })
						}
					>
						{t.add}
					</Button>
				</div>
			)}
			{data.nodeType === "send-list" && (
				<label className="flex flex-col gap-1" htmlFor={listId}>
					{t.listLabel}
					<Input
						id={listId}
						className="h-7 text-xs"
						value={data.buttonText ?? "Menu"}
						onChange={(event) => onUpdate({ buttonText: event.target.value })}
					/>
				</label>
			)}
			<p className="text-muted-foreground">{t.note}</p>
		</div>
	);
}
