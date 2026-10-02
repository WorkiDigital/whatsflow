export const supportedLocales = ["en", "pt", "es"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";

export const localeCookieName = "wf_locale";

export const localeLabels: Record<Locale, string> = {
	en: "English",
	pt: "Português",
	es: "Español",
};

export function isLocale(value: unknown): value is Locale {
	return (
		typeof value === "string" &&
		(supportedLocales as readonly string[]).includes(value)
	);
}

export function resolveLocale(value: unknown): Locale {
	return isLocale(value) ? value : defaultLocale;
}

/**
 * Picks the best supported locale from an Accept-Language header. Used on the
 * server for the initial render, so a first-time visitor with a Portuguese
 * browser sees the app in Portuguese before any cookie exists.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined) {
	if (!acceptLanguage) return defaultLocale;

	const ranked = acceptLanguage
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";");
			const qParam = params.find((param) => param.trim().startsWith("q="));
			const quality = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
			return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
		})
		.filter((entry) => entry.tag.length > 0)
		.sort((a, b) => b.quality - a.quality);

	for (const { tag } of ranked) {
		const base = tag.split("-")[0];
		if (isLocale(base)) return base;
	}

	return defaultLocale;
}

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
	en: {
		"common.language": "Language",
		"common.loading": "Loading",
		"common.save": "Save",
		"common.saving": "Saving",
		"common.cancel": "Cancel",
		"common.signOut": "Sign out",
		"auth.signIn": "Sign in",
		"auth.signUp": "Sign up",
		"auth.email": "Email",
		"auth.password": "Password",
		"auth.confirmPassword": "Confirm password",
		"auth.name": "Name",
		"auth.signInSuccess": "Sign in successful",
		"auth.inviteAccepted": "Workspace invite accepted",
		"auth.inviteUnavailable": "This invite is no longer available.",
		"auth.inviteError": "Unable to accept the invite",
		"auth.redirecting": "Redirecting...",
		"auth.continueWith": "Continue with {provider}",
		"auth.orContinueEmail": "or continue with email",
		"auth.signUpTitle": "Create your account",
		"auth.noAccount": "Don't have an account?",
		"auth.hasAccount": "Already have an account?",
		"auth.signingIn": "Signing in",
		"auth.signingUp": "Creating account",
		"auth.submitting": "Submitting...",
		"auth.signupSuccess": "Sign up successful",
		"auth.signupSuccessInvite": "Sign up successful and invite accepted",
		"auth.inviteLoading": "Loading invite...",
		"auth.inviteAccepting": "You are accepting an invite.",
		"auth.inviteHint": "Sign up with the email address that received the invite.",
		"auth.inviteInvalid": "Invite is not valid.",
		"auth.err.nameMin": "Name must be at least 2 characters",
		"auth.err.emailInvalid": "Invalid email address",
		"auth.err.passwordMin": "Password must be at least 8 characters",
		"auth.err.passwordConfirm": "Confirm your password",
		"auth.err.passwordMismatch": "Passwords do not match",
		"nav.dashboard": "Dashboard",
		"nav.overview": "Overview",
		"nav.devices": "Devices",
		"nav.flows": "Flows",
		"nav.inbox": "Inbox",
		"nav.contacts": "Contacts",
		"nav.groups": "Groups",
		"nav.newsletters": "Newsletters",
		"nav.webhooks": "Webhooks",
		"nav.logs": "Logs",
		"nav.audit": "Audit",
		"nav.users": "Users",
		"nav.roles": "Roles",
		"nav.settings": "Settings",
		"nav.newFlow": "New Flow",
		"nav.workspace": "Workspace",
		"nav.accountDetails": "Account details",
		"nav.contactSupport": "Contact support",
		"nav.account": "Account",
		"dashboard.subtitle": "Manage devices, flows, inbox, and automation logs.",
		"login.step.pair": "Pair device",
		"login.step.build": "Build flow",
		"login.step.reply": "Reply safely",
		"login.hero": "Access your {app} workspace.",
		"login.heroDescription": "Sign in to manage devices, deploy flow automations, and monitor conversation runs from the dashboard shell.",
		"login.signUpTitle": "Create workspace account",
		"login.welcomeBack": "Welcome back",
		"login.signUpHint": "Create an account to start building WhatsApp flows.",
		"login.signInHint": "Sign in to continue to your dashboard.",
		"organizations.title": "Select an organization",
		"organizations.description": "Choose the organization you want to manage.",
		"organizations.empty": "No organizations available",
		"organizations.emptyHint": "Ask an organization administrator to add you as a member.",
		"organizations.missingSlug": "This workspace is missing its address and cannot be opened yet. An administrator needs to finish setting it up.",
	},
	pt: {
		"common.language": "Idioma",
		"common.loading": "Carregando",
		"common.save": "Salvar",
		"common.saving": "Salvando",
		"common.cancel": "Cancelar",
		"common.signOut": "Sair",
		"auth.signIn": "Entrar",
		"auth.signUp": "Criar conta",
		"auth.email": "E-mail",
		"auth.password": "Senha",
		"auth.confirmPassword": "Confirme a senha",
		"auth.name": "Nome",
		"auth.signInSuccess": "Login realizado",
		"auth.inviteAccepted": "Convite aceito",
		"auth.inviteUnavailable": "Este convite não está mais disponível.",
		"auth.inviteError": "Não foi possível aceitar o convite",
		"auth.redirecting": "Redirecionando...",
		"auth.continueWith": "Continuar com {provider}",
		"auth.orContinueEmail": "ou continue com e-mail",
		"auth.signUpTitle": "Crie sua conta",
		"auth.noAccount": "Não tem uma conta?",
		"auth.hasAccount": "Já tem uma conta?",
		"auth.signingIn": "Entrando",
		"auth.signingUp": "Criando conta",
		"auth.submitting": "Enviando...",
		"auth.signupSuccess": "Conta criada com sucesso",
		"auth.signupSuccessInvite": "Conta criada e convite aceito",
		"auth.inviteLoading": "Carregando convite...",
		"auth.inviteAccepting": "Você está aceitando um convite.",
		"auth.inviteHint": "Crie a conta com o e-mail que recebeu o convite.",
		"auth.inviteInvalid": "Convite inválido.",
		"auth.err.nameMin": "O nome deve ter pelo menos 2 caracteres",
		"auth.err.emailInvalid": "E-mail inválido",
		"auth.err.passwordMin": "A senha deve ter pelo menos 8 caracteres",
		"auth.err.passwordConfirm": "Confirme a senha",
		"auth.err.passwordMismatch": "As senhas não coincidem",
		"nav.dashboard": "Painel",
		"nav.overview": "Visão geral",
		"nav.devices": "Dispositivos",
		"nav.flows": "Fluxos",
		"nav.inbox": "Caixa de entrada",
		"nav.contacts": "Contatos",
		"nav.groups": "Grupos",
		"nav.newsletters": "Newsletters",
		"nav.webhooks": "Webhooks",
		"nav.logs": "Registros",
		"nav.audit": "Auditoria",
		"nav.users": "Usuários",
		"nav.roles": "Perfis",
		"nav.settings": "Configurações",
		"nav.newFlow": "Novo Fluxo",
		"nav.workspace": "Espaço de trabalho",
		"nav.accountDetails": "Detalhes da conta",
		"nav.contactSupport": "Falar com o suporte",
		"nav.account": "Conta",
		"dashboard.subtitle": "Gerencie dispositivos, fluxos, caixa de entrada e registros de automação.",
		"login.step.pair": "Conectar dispositivo",
		"login.step.build": "Criar fluxo",
		"login.step.reply": "Responder com segurança",
		"login.hero": "Acesse seu espaço de trabalho {app}.",
		"login.heroDescription": "Entre para gerenciar dispositivos, publicar automações de fluxo e acompanhar execuções de conversa pelo painel.",
		"login.signUpTitle": "Criar conta do espaço de trabalho",
		"login.welcomeBack": "Bem-vindo de volta",
		"login.signUpHint": "Crie uma conta para começar a montar fluxos de WhatsApp.",
		"login.signInHint": "Entre para continuar no seu painel.",
		"organizations.title": "Selecione uma organização",
		"organizations.description": "Escolha a organização que você quer gerenciar.",
		"organizations.empty": "Nenhuma organização disponível",
		"organizations.emptyHint": "Peça a um administrador da organização para adicioná-lo como membro.",
		"organizations.missingSlug": "Este espaço de trabalho está sem endereço e ainda não pode ser aberto. Um administrador precisa concluir a configuração.",
	},
	es: {
		"common.language": "Idioma",
		"common.loading": "Cargando",
		"common.save": "Guardar",
		"common.saving": "Guardando",
		"common.cancel": "Cancelar",
		"common.signOut": "Cerrar sesión",
		"auth.signIn": "Iniciar sesión",
		"auth.signUp": "Crear cuenta",
		"auth.email": "Correo electrónico",
		"auth.password": "Contraseña",
		"auth.confirmPassword": "Confirmar contraseña",
		"auth.name": "Nombre",
		"auth.signInSuccess": "Sesión iniciada",
		"auth.inviteAccepted": "Invitación aceptada",
		"auth.inviteUnavailable": "Esta invitación ya no está disponible.",
		"auth.inviteError": "No se pudo aceptar la invitación",
		"auth.redirecting": "Redirigiendo...",
		"auth.continueWith": "Continuar con {provider}",
		"auth.orContinueEmail": "o continúa con correo",
		"auth.signUpTitle": "Crea tu cuenta",
		"auth.noAccount": "¿No tienes una cuenta?",
		"auth.hasAccount": "¿Ya tienes una cuenta?",
		"auth.signingIn": "Iniciando sesión",
		"auth.signingUp": "Creando cuenta",
		"auth.submitting": "Enviando...",
		"auth.signupSuccess": "Cuenta creada correctamente",
		"auth.signupSuccessInvite": "Cuenta creada e invitación aceptada",
		"auth.inviteLoading": "Cargando invitación...",
		"auth.inviteAccepting": "Estás aceptando una invitación.",
		"auth.inviteHint": "Crea la cuenta con el correo que recibió la invitación.",
		"auth.inviteInvalid": "La invitación no es válida.",
		"auth.err.nameMin": "El nombre debe tener al menos 2 caracteres",
		"auth.err.emailInvalid": "Correo electrónico no válido",
		"auth.err.passwordMin": "La contraseña debe tener al menos 8 caracteres",
		"auth.err.passwordConfirm": "Confirma tu contraseña",
		"auth.err.passwordMismatch": "Las contraseñas no coinciden",
		"nav.dashboard": "Panel",
		"nav.overview": "Resumen",
		"nav.devices": "Dispositivos",
		"nav.flows": "Flujos",
		"nav.inbox": "Bandeja de entrada",
		"nav.contacts": "Contactos",
		"nav.groups": "Grupos",
		"nav.newsletters": "Newsletters",
		"nav.webhooks": "Webhooks",
		"nav.logs": "Registros",
		"nav.audit": "Auditoría",
		"nav.users": "Usuarios",
		"nav.roles": "Perfiles",
		"nav.settings": "Configuración",
		"nav.newFlow": "Nuevo flujo",
		"nav.workspace": "Espacio de trabajo",
		"nav.accountDetails": "Detalles de la cuenta",
		"nav.contactSupport": "Contactar con soporte",
		"nav.account": "Cuenta",
		"dashboard.subtitle": "Gestiona dispositivos, flujos, bandeja de entrada y registros de automatización.",
		"login.step.pair": "Conectar dispositivo",
		"login.step.build": "Crear flujo",
		"login.step.reply": "Responder de forma segura",
		"login.hero": "Accede a tu espacio de trabajo {app}.",
		"login.heroDescription": "Inicia sesión para gestionar dispositivos, desplegar automatizaciones de flujo y supervisar las ejecuciones de conversación desde el panel.",
		"login.signUpTitle": "Crear cuenta del espacio de trabajo",
		"login.welcomeBack": "Bienvenido de nuevo",
		"login.signUpHint": "Crea una cuenta para empezar a construir flujos de WhatsApp.",
		"login.signInHint": "Inicia sesión para continuar a tu panel.",
		"organizations.title": "Selecciona una organización",
		"organizations.description": "Elige la organización que quieres gestionar.",
		"organizations.empty": "No hay organizaciones disponibles",
		"organizations.emptyHint": "Pide a un administrador de la organización que te añada como miembro.",
		"organizations.missingSlug": "Este espacio de trabajo no tiene dirección y aún no se puede abrir. Un administrador debe terminar de configurarlo.",
	},
};

export function translate(
	locale: Locale,
	key: string,
	values?: Record<string, string | number>,
) {
	const template = dictionaries[locale]?.[key] ?? dictionaries[defaultLocale][key] ?? key;

	if (!values) return template;

	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = values[name];
		return value === undefined ? match : String(value);
	});
}
