import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@whatsapp-flow/ui/components/badge";
import { Button } from "@whatsapp-flow/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@whatsapp-flow/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@whatsapp-flow/ui/components/dropdown-menu";
import { Input } from "@whatsapp-flow/ui/components/input";
import {
	MoreHorizontal,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useActiveOrganization } from "@/components/active-organization";
import { DataTable } from "@/components/data-table";
import {
	ResourceSyncControls,
	useResourceSyncCompletion,
} from "@/components/resource-sync-controls";
import { TagBadges, TagPicker } from "@/components/tag-picker";
import { useTranslation as usePanelTranslation } from "@/i18n/provider";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard/$organizationSlug/contacts")({
	validateSearch: z.object({
		search: z.string().optional(),
	}),
	component: ContactsPage,
});

function ContactsPage() {
	const panelT = usePanelTranslation();

	const organization = useActiveOrganization();
	const trpc = useTRPC();
	const trackSyncCompletion = useResourceSyncCompletion("contacts");
	const { search: searchFromUrl } = Route.useSearch();
	const [search, setSearch] = useState(searchFromUrl ?? "");
	const [addOpen, setAddOpen] = useState(false);
	const [newPhone, setNewPhone] = useState("");
	const [newName, setNewName] = useState("");

	const { data: contacts = [], refetch } = useSuspenseQuery(
		trpc.contact.list.queryOptions({ search: search || undefined, limit: 100 }),
	);
	const { data: devices = [] } = useSuspenseQuery(
		trpc.device.list.queryOptions({ tenantId: organization.id }),
	);
	const defaultDeviceId = devices[0]?.id;
	const devicesById = new Map(devices.map((device) => [device.id, device]));

	useEffect(() => {
		if (searchFromUrl) setSearch(searchFromUrl);
	}, [searchFromUrl]);

	const addMut = useMutation(
		trpc.contact.create.mutationOptions({
			onSuccess: () => {
				setAddOpen(false);
				setNewPhone("");
				setNewName("");
				toast.success(panelT("Contact added"));
				refetch();
			},
			onError: (e) => toast.error(e.message ?? "Failed to add contact"),
		}),
	);

	const deleteMut = useMutation(
		trpc.contact.delete.mutationOptions({
			onSuccess: () => {
				toast.success(panelT("Contact deleted"));
				refetch();
			},
			onError: (e) => toast.error(e.message ?? "Failed to delete contact"),
		}),
	);
	const syncOneMut = useMutation(
		trpc.contact.syncOne.mutationOptions({
			onSuccess: (result) => {
				trackSyncCompletion(result);
				toast.success(panelT("Contact sync queued"));
			},
			onError: (error) => toast.error(panelT(error.message)),
		}),
	);

	const columns = [
		{
			key: "name",
			header: panelT("Name"),
			cell: (row: (typeof contacts)[0]) => {
				const primary = row.phoneNumber ?? row.name ?? row.pushName ?? row.jid;
				const secondary = [row.name, row.pushName]
					.filter((value) => value && value !== primary)
					.join(" · ");
				return (
					<div className="flex flex-col">
						<span className="font-medium text-xs">{primary}</span>
						{secondary && (
							<span className="text-[10px] text-muted-foreground">
								{secondary}
							</span>
						)}
					</div>
				);
			},
		},
		{
			key: "phoneNumber",
			header: panelT("Phone"),
			cell: (row: (typeof contacts)[0]) => (
				<span className="text-xs">{row.phoneNumber ?? row.jid}</span>
			),
		},
		{
			key: "source",
			header: panelT("Source"),
			cell: (row: (typeof contacts)[0]) => (
				<Badge variant="outline" className="h-4 px-1 text-[9px]">
					{row.source}
				</Badge>
			),
		},
		{
			key: "isWaContact",
			header: panelT("WA"),
			cell: (row: (typeof contacts)[0]) => (
				<Badge
					variant={row.isWaContact ? "default" : "secondary"}
					className="h-4 px-1 text-[9px]"
				>
					{row.isWaContact ? "✓" : "—"}
				</Badge>
			),
		},
		{
			key: "tags",
			header: panelT("Tags"),
			cell: (row: (typeof contacts)[0]) => (
				<div className="flex items-center gap-1">
					<TagBadges tags={row.tags} />
					<TagPicker
						resource="contact"
						resourceId={row.id}
						tags={row.tags}
						onSaved={refetch}
					/>
				</div>
			),
		},
		{
			key: "actions",
			header: "",
			cell: (row: (typeof contacts)[0]) => {
				const device = devicesById.get(row.deviceId);
				const canSync =
					device?.provider !== "meta_cloud" && device?.status === "connected";
				return (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon-xs" className="size-6" />
							}
						>
							<MoreHorizontal className="size-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								disabled={!canSync || syncOneMut.isPending}
								onClick={() =>
									syncOneMut.mutate({ id: row.id, mode: "normal" })
								}
							>
								<RefreshCw className="size-3.5" />
								{panelT("Refresh from WhatsApp")}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => deleteMut.mutate({ id: row.id })}
							>
								<Trash2 className="size-3.5" />
								{panelT("Delete")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-base">{panelT("Contacts")}</h1>
					<p className="text-muted-foreground text-xs">
						{contacts.length}{" "}
						{panelT("contacts · synced from your WhatsApp devices")}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<ResourceSyncControls devices={devices} resource="contacts" />
					<Dialog open={addOpen} onOpenChange={setAddOpen}>
						<DialogTrigger
							render={<Button size="sm" className="h-7 gap-1.5 text-xs" />}
						>
							<Plus className="size-3.5" />
							{panelT("Add Contact")}
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>{panelT("Add Contact")}</DialogTitle>
								<DialogDescription>
									{panelT("Manually add a WhatsApp contact by phone number.")}
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col gap-3">
								<div className="flex flex-col gap-1">
									<label
										className="font-medium text-xs"
										htmlFor="contact-phone"
									>
										{panelT("Phone Number *")}
									</label>
									<Input
										id="contact-phone"
										placeholder="6281234567890"
										value={newPhone}
										onChange={(e) => setNewPhone(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-1">
									<label className="font-medium text-xs" htmlFor="contact-name">
										{panelT("Name")}
									</label>
									<Input
										id="contact-name"
										placeholder={panelT("John Doe")}
										value={newName}
										onChange={(e) => setNewName(e.target.value)}
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setAddOpen(false)}
								>
									{panelT("Cancel")}
								</Button>
								<Button
									size="sm"
									disabled={
										!newPhone.trim() || !defaultDeviceId || addMut.isPending
									}
									onClick={() => {
										if (!defaultDeviceId) return;
										addMut.mutate({
											deviceId: defaultDeviceId,
											phoneNumber: newPhone.trim(),
											name: newName.trim() || undefined,
										});
									}}
								>
									{addMut.isPending ? panelT("Adding...") : panelT("Add")}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<div className="relative max-w-xs">
				<Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="h-8 pl-8 text-xs"
					placeholder={panelT("Search contacts...")}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{contacts.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
					<Users className="size-8 opacity-30" />
					<p className="text-xs">
						{search
							? panelT("No contacts found")
							: panelT("No contacts yet — connect a device to sync")}
					</p>
				</div>
			) : (
				<DataTable
					data={contacts}
					columns={columns}
					getRowKey={(row) => row.id}
				/>
			)}
		</div>
	);
}
