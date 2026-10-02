import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@whatsapp-flow/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@whatsapp-flow/ui/components/avatar";
import { Badge } from "@whatsapp-flow/ui/components/badge";
import { Button } from "@whatsapp-flow/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@whatsapp-flow/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@whatsapp-flow/ui/components/dropdown-menu";
import { Input } from "@whatsapp-flow/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@whatsapp-flow/ui/components/native-select";
import { Skeleton } from "@whatsapp-flow/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@whatsapp-flow/ui/components/table";
import { Textarea } from "@whatsapp-flow/ui/components/textarea";
import {
	Copy,
	MoreHorizontal,
	ShieldCheck,
	Trash2,
	UserCog,
	UserPlus,
	UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation as usePanelTranslation } from "@/i18n/provider";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard/$organizationSlug/users")({
	component: UsersPage,
});

type RoleFilter = "all" | "admin" | "member";
type StatusFilter = "all" | "active" | "suspended";
type UserAction =
	| { type: "role"; userId: string; name: string; role: "admin" | "member" }
	| { type: "sessions"; userId: string; name: string }
	| { type: "suspend"; userId: string; name: string }
	| { type: "reactivate"; userId: string; name: string };

type AdminUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image?: string | null;
	role: "admin" | "member";
	status: "active" | "suspended";
	suspendedAt?: Date | string | null;
	suspensionReason?: string | null;
	createdAt: Date | string;
	sessionCount: number;
	accountCount: number;
	isCurrentUser: boolean;
};

type TenantMember = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
	role: "owner" | "member";
	createdAt: Date | string;
};

function getInitials(name?: string | null, email?: string | null) {
	const value = name || email || "User";
	return value
		.split(" ")
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join("")
		.toUpperCase();
}

function roleBadgeVariant(role: AdminUser["role"]) {
	return role === "admin" ? "default" : "secondary";
}

function statusBadgeVariant(status: AdminUser["status"]) {
	return status === "active" ? "secondary" : "destructive";
}

function actionTitle(action: UserAction | null) {
	if (!action) return "Confirm action";
	if (action.type === "sessions") return "Revoke user sessions?";
	if (action.type === "suspend") return "Suspend user account?";
	if (action.type === "reactivate") return "Reactivate user account?";
	return action.role === "admin"
		? "Promote user to admin?"
		: "Demote admin to member?";
}

function actionDescription(
	action: UserAction | null,
	t: ReturnType<typeof usePanelTranslation>,
) {
	if (!action) return "";
	if (action.type === "sessions") {
		return t(
			"This will sign {name} out of all active sessions. They can sign in again if their account remains valid.",
			{ name: action.name },
		);
	}
	if (action.type === "suspend") {
		return t(
			"This will block {name} from dashboard access and revoke all active sessions. A reason is required for the audit log.",
			{ name: action.name },
		);
	}
	if (action.type === "reactivate") {
		return t(
			"{name} will regain access and their suspension metadata will be cleared.",
			{ name: action.name },
		);
	}
	if (action.role === "admin") {
		return t(
			"{name} will gain access to admin settings, enterprise audit, and user management.",
			{ name: action.name },
		);
	}
	return t("{name} will lose admin access and become a regular member.", {
		name: action.name,
	});
}

function UsersPage() {
	const panelT = usePanelTranslation();

	const trpc = useTRPC();
	const { data: session } = authClient.useSession();
	const tenantId = session?.user.id;
	const [query, setQuery] = useState("");
	const [role, setRole] = useState<RoleFilter>("all");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [pendingAction, setPendingAction] = useState<UserAction | null>(null);
	const [reason, setReason] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRoleId, setInviteRoleId] = useState("");
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [tenantInviteEmail, setTenantInviteEmail] = useState("");
	const [tenantInviteLink, setTenantInviteLink] = useState<string | null>(null);
	const [memberToRemove, setMemberToRemove] = useState<TenantMember | null>(
		null,
	);
	const listInput = useMemo(
		() => ({
			query: query.trim() || undefined,
			role,
			status,
			limit: 50,
			offset: 0,
		}),
		[query, role, status],
	);
	const usersQuery = useQuery(trpc.user.list.queryOptions(listInput));
	const permissionsQuery = useQuery(trpc.rbac.me.queryOptions());
	const canInvite =
		permissionsQuery.data?.permissions.includes("users.manage") ?? false;
	const rolesQuery = useQuery({
		...trpc.rbac.listRoles.queryOptions(),
		enabled: canInvite,
	});
	const invitesQuery = useQuery({
		...trpc.user.listInvites.queryOptions(),
		enabled: canInvite,
	});
	const tenantMembersQuery = useQuery({
		...trpc.tenant.listMembers.queryOptions({ tenantId: tenantId ?? "" }),
		enabled: Boolean(tenantId),
	});
	const tenantInvitesQuery = useQuery({
		...trpc.tenant.listInvites.queryOptions({ tenantId: tenantId ?? "" }),
		enabled: Boolean(tenantId),
	});
	const createInvite = useMutation(
		trpc.user.createInvite.mutationOptions({
			onSuccess: (result) => {
				setInviteLink(result.inviteLink);
				setInviteEmail("");
				void invitesQuery.refetch();
				if (result.emailSent) {
					toast.success(panelT("Invite created and email sent"));
				} else {
					toast.warning(
						panelT(result.emailError ?? "Invite created; email was not sent"),
					);
				}
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const revokeInvite = useMutation(
		trpc.user.revokeInvite.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("Invite revoked"));
				void invitesQuery.refetch();
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const createTenantInvite = useMutation(
		trpc.tenant.createInvite.mutationOptions({
			onSuccess: (result) => {
				setTenantInviteLink(result.inviteLink);
				setTenantInviteEmail("");
				void tenantInvitesQuery.refetch();
				if (result.emailSent) {
					toast.success(panelT("Tenant invite created and email sent"));
				} else {
					toast.warning(
						panelT(
							result.emailError ?? "Tenant invite created; email was not sent",
						),
					);
				}
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const revokeTenantInvite = useMutation(
		trpc.tenant.revokeInvite.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("Tenant invite revoked"));
				void tenantInvitesQuery.refetch();
			},
			onError: (error) => {
				if (error.data?.code === "NOT_FOUND") {
					toast.info(panelT("This tenant invite has already been revoked."));
					void tenantInvitesQuery.refetch();
					return;
				}
				toast.error(panelT(error.message));
			},
		}),
	);
	const removeTenantMember = useMutation(
		trpc.tenant.removeMember.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("Tenant member removed"));
				setMemberToRemove(null);
				void tenantMembersQuery.refetch();
			},
			onError: (error) => {
				if (error.data?.code === "NOT_FOUND") {
					toast.info(panelT("This user is no longer a tenant member."));
					setMemberToRemove(null);
					void tenantMembersQuery.refetch();
					return;
				}
				toast.error(panelT(error.message));
			},
		}),
	);
	const updateRole = useMutation(
		trpc.user.updateRole.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("User role updated"));
				setPendingAction(null);
				usersQuery.refetch();
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const revokeSessions = useMutation(
		trpc.user.revokeSessions.mutationOptions({
			onSuccess: (result) => {
				toast.success(
					result.revoked > 0
						? `Revoked ${result.revoked} session${result.revoked === 1 ? "" : "s"}`
						: "No active sessions to revoke",
				);
				setPendingAction(null);
				usersQuery.refetch();
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const suspendUser = useMutation(
		trpc.user.suspend.mutationOptions({
			onSuccess: (result) => {
				toast.success(
					panelT("User suspended{v0}", {
						v0:
							result.revoked > 0
								? ` and ${result.revoked} session${result.revoked === 1 ? "" : "s"} revoked`
								: "",
					}),
				);
				setPendingAction(null);
				setReason("");
				usersQuery.refetch();
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const reactivateUser = useMutation(
		trpc.user.reactivate.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("User reactivated"));
				setPendingAction(null);
				setReason("");
				usersQuery.refetch();
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);
	const users = usersQuery.data?.users ?? [];
	const inviteRoles = rolesQuery.data ?? [];
	const invites = invitesQuery.data ?? [];
	const tenantMembers = tenantMembersQuery.data ?? [];
	const pendingTenantInvites = (tenantInvitesQuery.data ?? []).filter(
		(invite) => invite.status === "pending",
	);
	const isTenantOwner = Boolean(tenantId && tenantMembersQuery.data);
	const tenantInviteDisabled =
		createTenantInvite.isPending || !tenantInviteEmail.trim() || !tenantId;
	const actionPending =
		updateRole.isPending ||
		revokeSessions.isPending ||
		suspendUser.isPending ||
		reactivateUser.isPending;
	const reasonRequired = pendingAction?.type === "suspend";
	const confirmDisabled =
		actionPending || (reasonRequired && reason.trim().length === 0);
	const inviteDisabled =
		createInvite.isPending || !inviteEmail.trim() || !inviteRoleId;

	useEffect(() => {
		if (!inviteRoleId && inviteRoles.length > 0) {
			setInviteRoleId(
				inviteRoles.find((item) => item.key === "member")?.id ??
					inviteRoles[0].id,
			);
		}
	}, [inviteRoleId, inviteRoles]);

	const createInviteLink = () => {
		if (inviteDisabled) return;
		createInvite.mutate({
			email: inviteEmail.trim(),
			roleId: inviteRoleId,
		});
	};

	const copyInviteLink = async () => {
		if (!inviteLink) return;
		await navigator.clipboard.writeText(inviteLink);
		toast.success(panelT("Invite link copied"));
	};

	const createTenantInviteLink = () => {
		if (tenantInviteDisabled || !tenantId) return;
		createTenantInvite.mutate({
			tenantId,
			email: tenantInviteEmail.trim(),
		});
	};

	const copyTenantInviteLink = async () => {
		if (!tenantInviteLink) return;
		await navigator.clipboard.writeText(tenantInviteLink);
		toast.success(panelT("Tenant invite link copied"));
	};

	const openAction = (action: UserAction) => {
		setReason("");
		setPendingAction(action);
	};

	const confirmAction = () => {
		if (!pendingAction) return;
		if (pendingAction.type === "sessions") {
			revokeSessions.mutate({ userId: pendingAction.userId });
			return;
		}
		if (pendingAction.type === "suspend") {
			suspendUser.mutate({
				userId: pendingAction.userId,
				reason: reason.trim(),
			});
			return;
		}
		if (pendingAction.type === "reactivate") {
			reactivateUser.mutate({
				userId: pendingAction.userId,
				reason: reason.trim() || undefined,
			});
			return;
		}
		updateRole.mutate({
			userId: pendingAction.userId,
			role: pendingAction.role,
		});
	};

	if (usersQuery.error) {
		return (
			<div className="space-y-2">
				<h2 className="font-semibold text-xl">{panelT("Users unavailable")}</h2>
				<p className="text-muted-foreground text-sm">
					{usersQuery.error.message === "Admin access required"
						? panelT("You do not have access to user management.")
						: usersQuery.error.message}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<h2 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
						<UsersRound className="size-6 text-primary" />
						{panelT("Users")}
					</h2>
					<p className="text-muted-foreground text-sm">
						{panelT(
							"Manage dashboard users, administrator access, suspensions, and active sessions.",
						)}
					</p>
				</div>
			</div>

			{canInvite && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UserPlus className="size-5" />
							{panelT("Invite user")}
						</CardTitle>
						<CardDescription>
							{panelT(
								"Generate a one-time invite link and assign the user's initial role.",
							)}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
							<Input
								type="email"
								placeholder={panelT("teammate@example.com")}
								value={inviteEmail}
								onChange={(event) => setInviteEmail(event.target.value)}
							/>
							<NativeSelect
								value={inviteRoleId}
								onChange={(event) => setInviteRoleId(event.target.value)}
							>
								{inviteRoles.map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.name}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<Button
								type="button"
								disabled={inviteDisabled}
								onClick={createInviteLink}
							>
								{createInvite.isPending
									? panelT("Creating...")
									: panelT("Create invite")}
							</Button>
						</div>

						{inviteLink && (
							<div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
								<p className="break-all font-mono text-xs">{inviteLink}</p>
								<Button
									type="button"
									variant="outline"
									onClick={copyInviteLink}
								>
									<Copy className="size-4" />
									{panelT("Copy")}
								</Button>
							</div>
						)}

						{invites.length > 0 && (
							<div className="rounded-lg border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{panelT("Email")}</TableHead>
											<TableHead>{panelT("Role")}</TableHead>
											<TableHead>{panelT("Status")}</TableHead>
											<TableHead>{panelT("Email delivery")}</TableHead>
											<TableHead>{panelT("Expires")}</TableHead>
											<TableHead className="text-right">
												{panelT("Actions")}
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{invites.map((invite) => (
											<TableRow key={invite.id}>
												<TableCell>{invite.email}</TableCell>
												<TableCell>{invite.roleName}</TableCell>
												<TableCell>
													<Badge variant="outline">
														{panelT(invite.status)}
													</Badge>
												</TableCell>
												<TableCell>
													{invite.emailSentAt ? (
														<Badge variant="secondary">{panelT("Sent")}</Badge>
													) : invite.emailError ? (
														<Badge variant="destructive">
															{panelT("Failed")}
														</Badge>
													) : (
														<Badge variant="outline">
															{panelT("Not sent")}
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{new Date(invite.expiresAt).toLocaleDateString()}
												</TableCell>
												<TableCell className="text-right">
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={
															invite.status !== "pending" ||
															revokeInvite.isPending
														}
														onClick={() =>
															revokeInvite.mutate({ inviteId: invite.id })
														}
													>
														{panelT("Revoke")}
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{isTenantOwner && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<UsersRound className="size-5" />
							{panelT("Tenant members")}
						</CardTitle>
						<CardDescription>
							{panelT(
								"Invite collaborators and manage membership for your personal workspace. Only tenant owners can make these changes.",
							)}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
							<Input
								type="email"
								placeholder={panelT("teammate@example.com")}
								value={tenantInviteEmail}
								onChange={(event) => setTenantInviteEmail(event.target.value)}
							/>
							<Button
								type="button"
								disabled={tenantInviteDisabled}
								onClick={createTenantInviteLink}
							>
								{createTenantInvite.isPending
									? panelT("Creating...")
									: panelT("Invite member")}
							</Button>
						</div>

						{tenantInviteLink && (
							<div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
								<p className="break-all font-mono text-xs">
									{tenantInviteLink}
								</p>
								<Button
									type="button"
									variant="outline"
									onClick={copyTenantInviteLink}
								>
									<Copy className="size-4" />
									{panelT("Copy")}
								</Button>
							</div>
						)}

						<div className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{panelT("Member")}</TableHead>
										<TableHead>{panelT("Role")}</TableHead>
										<TableHead>{panelT("Joined")}</TableHead>
										<TableHead className="text-right">
											{panelT("Actions")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tenantMembers.map((member) => (
										<TableRow key={member.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<Avatar className="size-9 border bg-background">
														<AvatarFallback>
															{getInitials(member.name, member.email)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="truncate font-medium">
															{member.name || panelT("Unnamed user")}
															{member.id === session?.user.id && (
																<span className="ml-2 text-muted-foreground text-xs">
																	{panelT("You")}
																</span>
															)}
														</p>
														<p className="truncate text-muted-foreground text-xs">
															{member.email}
														</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge
													variant={
														member.role === "owner" ? "default" : "secondary"
													}
												>
													{panelT(member.role)}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(member.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell className="text-right">
												<Button
													type="button"
													variant="outline"
													size="sm"
													disabled={
														member.id === session?.user.id ||
														removeTenantMember.isPending
													}
													onClick={() => setMemberToRemove(member)}
												>
													<Trash2 className="size-4" />
													{panelT("Remove")}
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						{pendingTenantInvites.length > 0 && (
							<div className="space-y-2">
								<p className="font-medium text-sm">
									{panelT("Pending invitations")}
								</p>
								<div className="rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>{panelT("Email")}</TableHead>
												<TableHead>{panelT("Sent")}</TableHead>
												<TableHead>{panelT("Expires")}</TableHead>
												<TableHead className="text-right">
													{panelT("Actions")}
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{pendingTenantInvites.map((invite) => (
												<TableRow key={invite.id}>
													<TableCell>{invite.email}</TableCell>
													<TableCell>
														{invite.emailSentAt ? (
															<Badge variant="secondary">
																{panelT("Sent")}
															</Badge>
														) : invite.emailError ? (
															<Badge variant="destructive">
																{panelT("Failed")}
															</Badge>
														) : (
															<Badge variant="outline">
																{panelT("Not sent")}
															</Badge>
														)}
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{new Date(invite.expiresAt).toLocaleDateString()}
													</TableCell>
													<TableCell className="text-right">
														<Button
															type="button"
															variant="outline"
															size="sm"
															disabled={revokeTenantInvite.isPending}
															onClick={() => {
																if (!tenantId) return;
																revokeTenantInvite.mutate({
																	tenantId,
																	inviteId: invite.id,
																});
															}}
														>
															{panelT("Revoke")}
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<UserCog className="size-5" />
						{panelT("User management")}
					</CardTitle>
					<CardDescription>
						{panelT(
							"Role and suspension changes are audit logged. Destructive account deletion is intentionally not available here.",
						)}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<Input
							className="lg:max-w-sm"
							placeholder={panelT("Search by name or email")}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<NativeSelect
								value={role}
								onChange={(event) => setRole(event.target.value as RoleFilter)}
							>
								<NativeSelectOption value="all">
									{panelT("All roles")}
								</NativeSelectOption>
								<NativeSelectOption value="admin">
									{panelT("Admins")}
								</NativeSelectOption>
								<NativeSelectOption value="member">
									{panelT("Members")}
								</NativeSelectOption>
							</NativeSelect>
							<NativeSelect
								value={status}
								onChange={(event) =>
									setStatus(event.target.value as StatusFilter)
								}
							>
								<NativeSelectOption value="all">
									{panelT("All statuses")}
								</NativeSelectOption>
								<NativeSelectOption value="active">
									{panelT("Active")}
								</NativeSelectOption>
								<NativeSelectOption value="suspended">
									{panelT("Suspended")}
								</NativeSelectOption>
							</NativeSelect>
						</div>
					</div>

					{usersQuery.isPending ? (
						<div className="space-y-2">
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
							<Skeleton className="h-10" />
						</div>
					) : (
						<div className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{panelT("User")}</TableHead>
										<TableHead>{panelT("Role")}</TableHead>
										<TableHead>{panelT("Status")}</TableHead>
										<TableHead>{panelT("Email")}</TableHead>
										<TableHead>{panelT("Sessions")}</TableHead>
										<TableHead>{panelT("Accounts")}</TableHead>
										<TableHead>{panelT("Created")}</TableHead>
										<TableHead className="text-right">
											{panelT("Actions")}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{users.map((user) => (
										<TableRow key={user.id}>
											<TableCell>
												<div className="flex items-center gap-3">
													<Avatar className="size-9 border bg-background">
														<AvatarFallback>
															{getInitials(user.name, user.email)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="truncate font-medium">
															{user.name || panelT("Unnamed user")}
															{user.isCurrentUser && (
																<span className="ml-2 text-muted-foreground text-xs">
																	{panelT("You")}
																</span>
															)}
														</p>
														<p className="truncate text-muted-foreground text-xs">
															{user.email}
														</p>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={roleBadgeVariant(user.role)}>
													{panelT(user.role)}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													<Badge variant={statusBadgeVariant(user.status)}>
														{panelT(user.status)}
													</Badge>
													{user.suspendedAt && (
														<p className="text-muted-foreground text-xs">
															{panelT("Since")}{" "}
															{new Date(user.suspendedAt).toLocaleDateString()}
														</p>
													)}
												</div>
											</TableCell>
											<TableCell>
												{user.emailVerified ? (
													<Badge variant="secondary">
														{panelT("Verified")}
													</Badge>
												) : (
													<Badge variant="outline">
														{panelT("Unverified")}
													</Badge>
												)}
											</TableCell>
											<TableCell>{user.sessionCount}</TableCell>
											<TableCell>{user.accountCount}</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(user.createdAt).toLocaleDateString()}
											</TableCell>
											<TableCell className="text-right">
												<DropdownMenu>
													<DropdownMenuTrigger
														render={
															<Button
																variant="ghost"
																size="icon-xs"
																className="size-7"
															/>
														}
													>
														<MoreHorizontal className="size-4" />
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														{user.role === "admin" ? (
															<DropdownMenuItem
																disabled={user.isCurrentUser}
																onClick={() =>
																	openAction({
																		type: "role",
																		userId: user.id,
																		name: user.name || user.email,
																		role: "member",
																	})
																}
															>
																{panelT("Demote to member")}
															</DropdownMenuItem>
														) : (
															<DropdownMenuItem
																onClick={() =>
																	openAction({
																		type: "role",
																		userId: user.id,
																		name: user.name || user.email,
																		role: "admin",
																	})
																}
															>
																{panelT("Promote to admin")}
															</DropdownMenuItem>
														)}
														<DropdownMenuItem
															disabled={user.isCurrentUser}
															onClick={() =>
																openAction({
																	type: "sessions",
																	userId: user.id,
																	name: user.name || user.email,
																})
															}
														>
															{panelT("Revoke sessions")}
														</DropdownMenuItem>
														{user.status === "suspended" ? (
															<DropdownMenuItem
																onClick={() =>
																	openAction({
																		type: "reactivate",
																		userId: user.id,
																		name: user.name || user.email,
																	})
																}
															>
																{panelT("Reactivate")}
															</DropdownMenuItem>
														) : (
															<DropdownMenuItem
																disabled={user.isCurrentUser}
																onClick={() =>
																	openAction({
																		type: "suspend",
																		userId: user.id,
																		name: user.name || user.email,
																	})
																}
															>
																{panelT("Suspend")}
															</DropdownMenuItem>
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
									{users.length === 0 && (
										<TableRow>
											<TableCell colSpan={8}>
												<div className="py-8 text-center text-muted-foreground text-sm">
													{panelT("No users match the current filters.")}
												</div>
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					)}

					<div className="flex items-center justify-between text-muted-foreground text-xs">
						<span>
							{usersQuery.data?.total ?? 0} {panelT("total users")}
						</span>
						<span>{panelT("Showing up to 50 users")}</span>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<ShieldCheck className="size-5" />
						{panelT("Production safety notes")}
					</CardTitle>
					<CardDescription>
						{panelT(
							"User management now favors reversible controls with audit evidence.",
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
						<li>
							{panelT(
								"User deletion is disabled because auth and product data may cascade.",
							)}
						</li>
						<li>
							{panelT(
								"Suspension revokes sessions and blocks protected tRPC plus authenticated server routes.",
							)}
						</li>
						<li>
							{panelT(
								"Role changes, session revocations, suspensions, and reactivations are written to the immutable audit log.",
							)}
						</li>
					</ul>
				</CardContent>
			</Card>

			<AlertDialog
				open={Boolean(memberToRemove)}
				onOpenChange={(open) => {
					if (!open && !removeTenantMember.isPending) {
						setMemberToRemove(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{panelT("Remove tenant member?")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{memberToRemove
								? `${memberToRemove.name || memberToRemove.email} will lose access to this tenant's shared resources.`
								: panelT(
										"This member will lose access to this tenant's shared resources.",
									)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={removeTenantMember.isPending}>
							{panelT("Cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={
								removeTenantMember.isPending || !memberToRemove || !tenantId
							}
							onClick={() => {
								if (!memberToRemove || !tenantId) return;
								removeTenantMember.mutate({
									tenantId,
									userId: memberToRemove.id,
								});
							}}
						>
							{removeTenantMember.isPending
								? panelT("Removing...")
								: panelT("Remove")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(pendingAction)}
				onOpenChange={(open) => {
					if (!open && !actionPending) {
						setPendingAction(null);
						setReason("");
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{panelT(actionTitle(pendingAction))}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{actionDescription(pendingAction, panelT)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{(pendingAction?.type === "suspend" ||
						pendingAction?.type === "reactivate") && (
						<Textarea
							placeholder={
								pendingAction.type === "suspend"
									? panelT("Reason for suspension")
									: panelT("Optional reason for reactivation")
							}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							maxLength={500}
						/>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={actionPending}>
							{panelT("Cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={confirmDisabled}
							onClick={confirmAction}
						>
							{actionPending ? panelT("Working...") : panelT("Confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
