import { afterAll, beforeAll, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/node-postgres";
import { buildFlowListQuery } from "./flow-list-query";

const pg = new PGlite();
const db = drizzle.mock();

beforeAll(async () => {
	// Minimal PostgreSQL fixture for the actual production list query, including
	// the real grant enum. Mocked row results cannot catch enum coercion errors.
	await pg.exec(`
		CREATE TYPE flow_access_capability AS ENUM ('viewer', 'editor');
		CREATE TABLE "user" (id text PRIMARY KEY, name text, email text);
		CREATE TABLE device (id text PRIMARY KEY, name text);
		CREATE TABLE flow (
			id text PRIMARY KEY, user_id text, tenant_id text, name text,
			description text, status text, trigger_type text, device_id text,
			created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
		);
		CREATE TABLE flow_access_grant (
			flow_id text, tenant_id text, user_id text,
			capability flow_access_capability NOT NULL
		);
		INSERT INTO "user" VALUES ('owner', 'Owner', 'owner@example.com');
	`);
}, 20_000);

afterAll(async () => {
	await pg.close();
});

async function list(tenantId: string, userId: string) {
	const query = buildFlowListQuery(db, tenantId, userId).toSQL();
	return pg.query<{ id: string; coalesce: string }>(query.sql, query.params);
}

test("lists an empty workspace without trying to cast owner to the grant enum", async () => {
	expect((await list("empty", "owner")).rows).toEqual([]);
});

test("lists owner, viewer and editor capabilities with tenant and user isolation", async () => {
	await pg.exec(`
		INSERT INTO flow (id, user_id, tenant_id, name) VALUES
			('owned', 'owner', 'workspace', 'Owned'),
			('viewed', 'owner', 'workspace', 'Viewed'),
			('edited', 'owner', 'workspace', 'Edited'),
			('other-user-grant', 'owner', 'workspace', 'Another user'),
			('other-tenant-grant', 'owner', 'workspace', 'Another tenant grant'),
			('foreign-flow', 'owner', 'foreign', 'Foreign');
		INSERT INTO flow_access_grant VALUES
			('viewed', 'workspace', 'reader', 'viewer'),
			('edited', 'workspace', 'reader', 'editor'),
			('other-user-grant', 'workspace', 'different-user', 'viewer'),
			('other-tenant-grant', 'foreign', 'reader', 'editor'),
			('foreign-flow', 'foreign', 'reader', 'viewer');
	`);
	const { rows } = await list("workspace", "reader");
	expect(Object.fromEntries(rows.map((row) => [row.id, row.coalesce]))).toEqual(
		{
			owned: "owner",
			viewed: "viewer",
			edited: "editor",
			"other-user-grant": "owner",
			"other-tenant-grant": "owner",
		},
	);
});
