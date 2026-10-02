/**
 * Repairs organizations that were provisioned before workspace provisioning
 * was complete. Signup used to create the tenant row and the owner membership
 * but skipped the slug, the RBAC seed, and the owner's role assignment, which
 * left affected users unable to open their dashboard.
 *
 * Run with: bun run db:backfill
 */
import dotenv from "dotenv";
import { eq, isNull } from "drizzle-orm";
import { createDb } from "../src/index";
import { backfillOrganizationRbac } from "../src/organization-rbac";
import { repairWorkspaceSlug } from "../src/provision-workspace";
import { user } from "../src/schema/auth";
import { tenant } from "../src/schema/tenant";

async function main() {
	dotenv.config({ path: "../../apps/server/.env" });

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error(
			"DATABASE_URL is required. Set it in the environment or apps/server/.env.",
		);
	}

	const db = createDb();

	const missingSlugs = await db
		.select({
			id: tenant.id,
			name: tenant.name,
			createdByUserId: tenant.createdByUserId,
			creatorName: user.name,
		})
		.from(tenant)
		.innerJoin(user, eq(user.id, tenant.createdByUserId))
		.where(isNull(tenant.slug));

	console.log(`Organizations missing a slug: ${missingSlugs.length}`);

	for (const organization of missingSlugs) {
		// Derive the slug from the creator's name, which is what signup used,
		// rather than the "<name>'s workspace" organization label.
		const slug = await repairWorkspaceSlug(
			db,
			{
				id: organization.id,
				createdByUserId: organization.createdByUserId,
			},
			organization.creatorName,
		);
		console.log(`  ${organization.name} -> ${slug}`);
	}

	console.log("Seeding organization RBAC and role assignments...");
	await backfillOrganizationRbac(db);

	const stillMissing = await db
		.select({ id: tenant.id })
		.from(tenant)
		.where(isNull(tenant.slug));

	if (stillMissing.length > 0) {
		throw new Error(
			`${stillMissing.length} organization(s) still have no slug after the repair`,
		);
	}

	console.log("Backfill complete. Every organization now has a slug and RBAC.");
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
