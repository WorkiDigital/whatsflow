import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@whatsapp-flow/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@whatsapp-flow/ui/components/card";
import { Building2 } from "lucide-react";

import { useI18n } from "@/i18n/provider";

export const Route = createFileRoute("/dashboard/")({
	loader: async ({ context }) => {
		const organizations = (
			await context.queryClient.ensureQueryData(
				context.trpc.organization.listMine.queryOptions(),
			)
		).map((organization) => ({
			...organization,
			// Workspaces provisioned before the slug fix can still be missing it.
			// Keep them listed so the user is not locked out, but never try to
			// build a dashboard URL out of a null slug.
			slug: organization.slug ?? null,
		}));

		const withSlug = organizations.filter(
			(organization): organization is typeof organization & { slug: string } =>
				organization.slug !== null,
		);

		if (withSlug.length === 1 && organizations.length === 1) {
			throw redirect({
				to: "/dashboard/$organizationSlug",
				params: { organizationSlug: withSlug[0].slug },
			});
		}

		return { organizations };
	},
	component: OrganizationPickerPage,
});

function OrganizationPickerPage() {
	const { organizations } = Route.useLoaderData();
	const { t } = useI18n();

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
			<Card className="w-full max-w-lg">
				<CardHeader>
					<div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<Building2 className="size-5" />
					</div>
					<CardTitle>{t("organizations.title")}</CardTitle>
					<CardDescription>
						{t("organizations.description")}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{organizations.length === 0 ? (
						<div className="rounded-lg border border-dashed p-6 text-center">
							<p className="font-medium text-sm">{t("organizations.empty")}</p>
							<p className="mt-1 text-muted-foreground text-sm">
								{t("organizations.emptyHint")}
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{organizations.map((organization) =>
								organization.slug === null ? (
									<div
										key={organization.id}
										className="rounded-lg border border-dashed p-4 text-left"
									>
										<span className="block truncate font-medium">
											{organization.name}
										</span>
										<span className="mt-1 block text-muted-foreground text-xs">
											{t("organizations.missingSlug")}
										</span>
									</div>
								) : (
									<Button
										key={organization.id}
										variant="outline"
										className="h-auto w-full justify-start px-4 py-3 text-left"
										render={
											<Link
												to="/dashboard/$organizationSlug"
												params={{ organizationSlug: organization.slug }}
											/>
										}
									>
										<span className="flex min-w-0 flex-col gap-0.5">
											<span className="truncate font-medium">
												{organization.name}
											</span>
											<span className="truncate text-muted-foreground text-xs">
												{organization.slug}
											</span>
										</span>
									</Button>
								),
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
