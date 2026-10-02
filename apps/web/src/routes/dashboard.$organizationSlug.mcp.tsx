import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@whatsapp-flow/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@whatsapp-flow/ui/components/card";
import { Input } from "@whatsapp-flow/ui/components/input";
import { Label } from "@whatsapp-flow/ui/components/label";
import { Copy, Eye, EyeOff, Plug, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	useI18n,
	useTranslation as usePanelTranslation,
} from "@/i18n/provider";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard/$organizationSlug/mcp")({
	component: McpPage,
});

const labels = {
	pt: {
		title: "Conexão MCP",
		description:
			"Conecte seu agente de IA ao WhatsFlow usando a URL e o token da sua conta.",
		url: "URL do MCP",
		token: "Token de acesso",
		copy: "Copiar",
		copied: "Copiado",
		copyFailed:
			"Não foi possível copiar. Selecione o campo e copie manualmente.",
		show: "Mostrar token",
		hide: "Ocultar token",
		active: "MCP ativado",
		disabled: "MCP desativado no servidor",
		missing: "Você ainda não tem um token. Gere um para conectar seu agente.",
		hint: "No seu cliente MCP, envie o token no cabeçalho Authorization: Bearer <token>. O agente terá as mesmas permissões da sua conta.",
		error: "Não foi possível carregar a conexão MCP.",
		retry: "Tentar novamente",
		loading: "Carregando…",
		revealError: "Não foi possível obter o token.",
		generate: "Gerar token",
		rotate: "Gerar novo token",
		revoke: "Revogar token",
		once: "Copie o token agora. Ele só é exibido ao ser gerado. Um novo token invalida o anterior.",
		revoked: "Token revogado",
	},
	en: {
		title: "MCP connection",
		description:
			"Connect your AI agent to WhatsFlow with your account URL and token.",
		url: "MCP URL",
		token: "Access token",
		copy: "Copy",
		copied: "Copied",
		copyFailed: "Could not copy. Select the field and copy manually.",
		show: "Show token",
		hide: "Hide token",
		active: "MCP enabled",
		disabled: "MCP disabled on the server",
		missing: "You do not have a token yet. Generate one to connect your agent.",
		hint: "In your MCP client, send the token in the Authorization: Bearer <token> header. The agent uses your account permissions.",
		error: "Could not load the MCP connection.",
		retry: "Try again",
		loading: "Loading…",
		revealError: "Could not retrieve the token.",
		generate: "Generate token",
		rotate: "Generate new token",
		revoke: "Revoke token",
		once: "Copy the token now. It is only displayed when issued. A new token invalidates the previous one.",
		revoked: "Token revoked",
	},
	es: {
		title: "Conexión MCP",
		description:
			"Conecta tu agente de IA a WhatsFlow con la URL y el token de tu cuenta.",
		url: "URL del MCP",
		token: "Token de acceso",
		copy: "Copiar",
		copied: "Copiado",
		copyFailed: "No se pudo copiar. Selecciona el campo y copia manualmente.",
		show: "Mostrar token",
		hide: "Ocultar token",
		active: "MCP activado",
		disabled: "MCP desactivado en el servidor",
		missing: "Aún no tienes un token. Genera uno para conectar tu agente.",
		hint: "En tu cliente MCP, envía el token en el encabezado Authorization: Bearer <token>. El agente tendrá los permisos de tu cuenta.",
		error: "No se pudo cargar la conexión MCP.",
		retry: "Intentar de nuevo",
		loading: "Cargando…",
		revealError: "No se pudo obtener el token.",
		generate: "Generar token",
		rotate: "Generar nuevo token",
		revoke: "Revocar token",
		once: "Copia el token ahora. Solo se muestra al generarlo. Un nuevo token invalida el anterior.",
		revoked: "Token revocado",
	},
};

function McpPage() {
	const panelT = usePanelTranslation();

	const trpc = useTRPC();
	const { locale } = useI18n();
	const text = labels[locale];
	const connection = useQuery(trpc.mcp.connection.queryOptions());
	const issue = useMutation(trpc.mcp.issueToken.mutationOptions());
	const revoke = useMutation(trpc.mcp.revokeToken.mutationOptions());
	const [token, setToken] = useState<string | null>(null);
	const [visible, setVisible] = useState(false);
	const busy = issue.isPending || revoke.isPending;
	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(text.copied);
		} catch {
			toast.error(text.copyFailed);
		}
	}
	async function issueToken() {
		setToken(null);
		try {
			const result = await issue.mutateAsync();
			setToken(result.token);
			setVisible(false);
			issue.reset();
			await connection.refetch();
		} catch {
			toast.error(text.revealError);
			issue.reset();
		}
	}
	async function revokeToken() {
		try {
			await revoke.mutateAsync();
			setToken(null);
			revoke.reset();
			await connection.refetch();
			toast.success(text.revoked);
		} catch {
			toast.error(text.revealError);
			revoke.reset();
		}
	}
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<div>
				<h2 className="flex items-center gap-2 font-semibold text-2xl">
					<Plug className="size-6" />
					{text.title}
				</h2>
				<p className="mt-2 text-muted-foreground text-sm">{text.description}</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>{panelT("MCP")}</CardTitle>
					<CardDescription>
						{connection.data
							? connection.data.enabled
								? text.active
								: text.disabled
							: text.loading}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{connection.isError ? (
						<div role="alert" className="space-y-3">
							<p>{text.error}</p>
							<Button variant="outline" onClick={() => connection.refetch()}>
								{text.retry}
							</Button>
						</div>
					) : connection.data ? (
						<>
							<div className="space-y-2">
								<Label htmlFor="mcp-url">{text.url}</Label>
								<div className="flex flex-col gap-2 sm:flex-row">
									<Input id="mcp-url" readOnly value={connection.data.url} />
									<Button
										variant="outline"
										onClick={() => copy(connection.data.url)}
									>
										<Copy className="size-4" />
										{text.copy}
									</Button>
								</div>
							</div>
							<div className="space-y-3">
								<Label htmlFor="mcp-token">{text.token}</Label>
								{token || connection.data.tokenConfigured ? (
									<Input
										id="mcp-token"
										readOnly
										autoComplete="off"
										type={token && !visible ? "password" : "text"}
										value={token ?? `${connection.data.prefix}••••••••••••`}
									/>
								) : (
									<p className="text-muted-foreground text-sm">
										{text.missing}
									</p>
								)}
								{token && (
									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											onClick={() => setVisible(!visible)}
										>
											{visible ? (
												<EyeOff className="size-4" />
											) : (
												<Eye className="size-4" />
											)}
											{visible ? text.hide : text.show}
										</Button>
										<Button variant="outline" onClick={() => copy(token)}>
											<Copy className="size-4" />
											{text.copy}
										</Button>
									</div>
								)}
								<p className="text-muted-foreground text-sm">{text.once}</p>
								<div className="flex flex-wrap gap-2">
									<Button disabled={busy} onClick={issueToken}>
										<RefreshCw className="size-4" />
										{connection.data.tokenConfigured
											? text.rotate
											: text.generate}
									</Button>
									{connection.data.tokenConfigured && (
										<Button
											variant="outline"
											disabled={busy}
											onClick={revokeToken}
										>
											<Trash2 className="size-4" />
											{text.revoke}
										</Button>
									)}
								</div>
							</div>
							<p className="text-muted-foreground text-sm">{text.hint}</p>
						</>
					) : (
						<p>{text.loading}</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
