import type { Prisma } from "./generated/prisma/client.js";

export function createAuditData({
  action,
  metadata,
  resourceId,
  resourceType,
  userId,
}: {
  action: string;
  metadata?: Prisma.InputJsonValue;
  resourceId: string;
  resourceType: string;
  userId: string;
}) {
  return {
    action,
    metadata,
    resourceId,
    resourceType,
    userId,
  };
}
