import { seedOrganizationRbac } from "./organization-rbac";
import { tenant, tenantMember } from "./schema/tenant";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

type Database = ReturnType<typeof import("./index").createDb>;

const MAX_SLUG_LENGTH = 63;
const MAX_SLUG_ATTEMPTS = 10;

function slugify(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-+$/g, "");
}

function baseSlug(name: string, userId: string) {
	const fromName = slugify(name);
	if (fromName.length >= 2) return fromName;

	// Names made entirely of characters the slug alphabet rejects (for example
	// "José" transliterates to "jose", but "李雷" reduces to nothing) still need
	// a stable, unique slug. Fall back to a short digest of the user id.
	return `workspace-${createHash("sha256").update(userId).digest("hex").slice(0, 8)}`;
}

async function findAvailableSlug(
	db: Database,
	name: string,
	userId: string,
) {
	const base = baseSlug(name, userId);

	for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
		const candidate =
			attempt === 0
				? base
				: `${base.slice(0, MAX_SLUG_LENGTH - 5)}-${createHash("sha256")
						.update(`${userId}:${attempt}`)
						.digest("hex")
						.slice(0, 4)}`;

		const [existing] = await db
			.select({ id: tenant.id })
			.from(tenant)
			.where(eq(tenant.slug, candidate))
			.limit(1);

		if (!existing) return candidate;
	}

	// Every derived candidate was taken; fall back to a fully random slug so
	// signup still succeeds instead of failing on a name collision.
	return `workspace-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Assigns a slug to an organization that predates workspace provisioning and
 * therefore has none. Used by the backfill script to repair existing rows.
 */
export async function repairWorkspaceSlug(
	db: Database,
	organization: { id: string; name: string },
) {
	const slug = await findAvailableSlug(db, organization.name, organization.id);

	await db
		.update(tenant)
		.set({ slug })
		.where(eq(tenant.id, organization.id));

	return slug;
}

export async function provisionWorkspace(
	db: Database,
	user: { id: string; name: string },
) {
	const slug = await findAvailableSlug(db, user.name, user.id);

	await db.transaction(async (tx) => {
		const [organization] = await tx
			.insert(tenant)
			.values({
				id: user.id,
				name: `${user.name}'s workspace`,
				slug,
				createdByUserId: user.id,
			})
			.onConflictDoNothing()
			.returning();

		// The user already has a personal tenant (re-entrant signup, or a retry
		// after a partial failure). Repair whatever is missing instead of
		// returning early, so the workspace is always fully provisioned.
		const organizationId = organization?.id ?? user.id;

		const [membership] = await tx
			.insert(tenantMember)
			.values({
				tenantId: organizationId,
				userId: user.id,
				role: "owner",
			})
			.onConflictDoNothing()
			.returning();

		if (!membership) {
			const [existingMembership] = await tx
				.select({ userId: tenantMember.userId })
				.from(tenantMember)
				.where(eq(tenantMember.tenantId, organizationId))
				.limit(1);

			if (!existingMembership) {
				// Neither insert applied, so the tenant row itself is missing.
				// The owner row is required before RBAC can reference it.
				throw new Error(
					"Personal workspace provisioning could not create the owner membership",
				);
			}
		}

		// Seed permissions, system roles, and role/permission links. This is the
		// step the signup path was missing: without it the owner has no
		// tenantRoleAssignment and every protected route answers
		// "Organization permission required".
		const { roleIds } = await seedOrganizationRbac(tx, organizationId);
		const ownerRoleId = roleIds.get("owner");
		if (!ownerRoleId) {
			throw new Error("Owner role was not seeded for the new workspace");
		}

		await tx
			.insert(tenantRoleAssignment)
			.values({
				tenantId: organizationId,
				userId: user.id,
				roleId: ownerRoleId,
				assignedByUserId: user.id,
			})
			.onConflictDoNothing();
	});
}
