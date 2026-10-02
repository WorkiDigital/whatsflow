import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@whatsapp-flow/ui/components/sidebar";
import {
	Activity,
	Bot,
	ClipboardList,
	Inbox,
	LayoutDashboard,
	Mail,
	Megaphone,
	MessageSquare,
	Plug,
	Plus,
	Settings,
	ShieldCheck,
	Smartphone,
	UserCircle,
	Users,
	UsersRound,
	Webhook,
} from "lucide-react";

import { useActiveOrganization } from "@/components/active-organization";
import { useI18n } from "@/i18n/provider";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const navItems = [
	{
		to: "/dashboard/$organizationSlug/mcp",
		labelKey: "MCP",
		icon: Plug,
		exact: false,
	},
	{
		to: "/dashboard/$organizationSlug",
		labelKey: "nav.overview",
		icon: LayoutDashboard,
		exact: true,
	},
	{
		to: "/dashboard/$organizationSlug/devices",
		labelKey: "nav.devices",
		icon: Smartphone,
		exact: false,
		permission: "devices.read",
	},
	{
		to: "/dashboard/$organizationSlug/flows",
		labelKey: "nav.flows",
		icon: MessageSquare,
		exact: false,
		permission: "flows.read",
	},
	{
		to: "/dashboard/$organizationSlug/inbox",
		labelKey: "nav.inbox",
		icon: Inbox,
		exact: false,
		permission: "inbox.read",
	},
	{
		to: "/dashboard/$organizationSlug/contacts",
		labelKey: "nav.contacts",
		icon: Users,
		exact: false,
	},
	{
		to: "/dashboard/$organizationSlug/groups",
		labelKey: "nav.groups",
		icon: UsersRound,
		exact: false,
	},
	{
		to: "/dashboard/$organizationSlug/newsletters",
		labelKey: "nav.newsletters",
		icon: Megaphone,
		exact: false,
	},
	{
		to: "/dashboard/$organizationSlug/logs",
		labelKey: "nav.logs",
		icon: Activity,
		exact: false,
	},
	{
		to: "/dashboard/$organizationSlug/webhooks",
		labelKey: "nav.webhooks",
		icon: Webhook,
		exact: false,
		permission: "webhooks.read",
	},
	{
		to: "/dashboard/$organizationSlug/users",
		labelKey: "nav.users",
		icon: UserCircle,
		exact: false,
		permission: "users.read",
	},
	{
		to: "/dashboard/$organizationSlug/roles",
		labelKey: "nav.roles",
		icon: ShieldCheck,
		exact: false,
		permission: "roles.read",
	},
	{
		to: "/dashboard/$organizationSlug/audit",
		labelKey: "nav.audit",
		icon: ClipboardList,
		exact: false,
		permission: "audit.read",
	},
	{
		to: "/dashboard/$organizationSlug/settings",
		labelKey: "nav.settings",
		icon: Settings,
		exact: false,
		permission: "settings.read",
	},
] as const;

function getInitials(name?: string | null, email?: string | null) {
	const value = name || email || "User";
	return value
		.split(" ")
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase();
}

function BrandMark({
	appName,
	logoUrl,
}: {
	appName: string;
	logoUrl?: string | null;
}) {
	if (logoUrl) {
		return (
			<img
				src={logoUrl}
				alt={`${appName} logo`}
				className="size-8 shrink-0 rounded-md border bg-muted object-contain shadow-sm"
			/>
		);
	}

	return (
		<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
			<Bot className="size-4" />
		</span>
	);
}

function Brand() {
	const trpc = useTRPC();
	const { data: publicSettings } = useQuery(
		trpc.settings.public.queryOptions(),
	);
	const branding = publicSettings?.branding;
	const appName = branding?.appName ?? "WhatsApp Flow";
	const appTagline = branding?.appTagline ?? "Automation builder";

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					render={<Link to="/" />}
					className="h-12 gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
					tooltip={appName}
				>
					<BrandMark appName={appName} logoUrl={branding?.logoUrl} />
					<span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
						<span className="block truncate font-semibold text-sm">
							{appName}
						</span>
						<span className="block truncate text-sidebar-foreground/60 text-xs">
							{appTagline}
						</span>
					</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

function SidebarNav() {
	const location = useLocation();
	const organization = useActiveOrganization();
	const trpc = useTRPC();
	const { t } = useI18n();
	const permissionsQuery = useQuery(trpc.rbac.me.queryOptions());
	const permissions = permissionsQuery.data
		? new Set(permissionsQuery.data.permissions)
		: null;

	return (
		<SidebarMenu>
			{navItems.map((item) => {
				const { to, labelKey, icon: Icon, exact } = item;
				const permission = "permission" in item ? item.permission : undefined;
				if (permission && permissions && !permissions.has(permission))
					return null;
				const path = to.replace("$organizationSlug", organization.slug);
				const active = exact
					? location.pathname === path
					: location.pathname === path ||
						location.pathname.startsWith(`${path}/`);
				const label = t(labelKey);

				return (
					<SidebarMenuItem key={to}>
						<SidebarMenuButton
							render={
								<Link
									to={to}
									params={{ organizationSlug: organization.slug }}
								/>
							}
							isActive={active}
							tooltip={label}
						>
							<Icon />
							<span>{label}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				);
			})}
		</SidebarMenu>
	);
}

function SidebarAccountFooter() {
	const organization = useActiveOrganization();
	const trpc = useTRPC();
	const { t } = useI18n();
	const { data: session } = authClient.useSession();
	const { data: publicSettings } = useQuery(
		trpc.settings.public.queryOptions(),
	);
	const supportEmail = publicSettings?.branding.supportEmail;
	const userName = session?.user.name || t("nav.account");
	const userEmail = session?.user.email;
	const initials = getInitials(session?.user.name, session?.user.email);

	return (
		<div className="space-y-2 rounded-lg border bg-card p-3 text-card-foreground group-data-[collapsible=icon]:hidden">
			<div className="flex items-center gap-2">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
					{initials}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-xs">{userName}</p>
					{userEmail && (
						<p className="truncate text-[10px] text-muted-foreground">
							{userEmail}
						</p>
					)}
				</div>
			</div>

			<div className="grid gap-1 text-xs">
				<Link
					to="/dashboard/$organizationSlug/account"
					params={{ organizationSlug: organization.slug }}
					className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<UserCircle className="size-3.5" />
					{t("nav.accountDetails")}
				</Link>
				{supportEmail && (
					<a
						href={`mailto:${supportEmail}`}
						className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Mail className="size-3.5" />
						{t("nav.contactSupport")}
					</a>
				)}
			</div>
		</div>
	);
}

export function DashboardSidebar({ className }: { className?: string }) {
	const organization = useActiveOrganization();
	const { t } = useI18n();

	return (
		<Sidebar collapsible="icon" variant="inset" className={className}>
			<SidebarHeader>
				<Brand />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link
											to="/dashboard/$organizationSlug/flows/new"
											params={{ organizationSlug: organization.slug }}
										/>
									}
									variant="outline"
									tooltip={t("nav.newFlow")}
								>
									<Plus />
									<span>{t("nav.newFlow")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>{t("nav.workspace")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarNav />
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarSeparator />
				<SidebarAccountFooter />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

export default DashboardSidebar;
