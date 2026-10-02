import type { createDb } from "@whatsapp-flow/db";
import { user } from "@whatsapp-flow/db/schema/auth";
import { device, flow, flowAccessGrant } from "@whatsapp-flow/db/schema/device";
import { and, desc, eq, sql } from "drizzle-orm";

export function buildFlowListQuery(
	db: ReturnType<typeof createDb>,
	tenantId: string,
	userId: string,
) {
	return db
		.select({
			id: flow.id,
			name: flow.name,
			description: flow.description,
			status: flow.status,
			triggerType: flow.triggerType,
			deviceId: flow.deviceId,
			deviceName: device.name,
			ownerName: user.name,
			ownerEmail: user.email,
			// The grant enum contains viewer/editor only; owner is a derived label.
			accessCapability: sql<
				"owner" | "editor" | "viewer"
			>`coalesce(${flowAccessGrant.capability}::text, 'owner')`,
			createdAt: flow.createdAt,
			updatedAt: flow.updatedAt,
		})
		.from(flow)
		.innerJoin(user, eq(user.id, flow.userId))
		.leftJoin(
			flowAccessGrant,
			and(
				eq(flowAccessGrant.flowId, flow.id),
				eq(flowAccessGrant.tenantId, flow.tenantId),
				eq(flowAccessGrant.userId, userId),
			),
		)
		.leftJoin(device, eq(flow.deviceId, device.id))
		.where(eq(flow.tenantId, tenantId))
		.orderBy(desc(flow.updatedAt));
}
