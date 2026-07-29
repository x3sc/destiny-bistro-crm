import type { Prisma } from "./generated/prisma/client.js";

export function createAuditData({
  action,
  establishmentId,
  metadata,
  resourceId,
  resourceType,
  userId,
}: {
  action: string;
  establishmentId: string;
  metadata?: Prisma.InputJsonValue;
  resourceId: string;
  resourceType: string;
  userId: string;
}) {
  return {
    action,
    establishmentId,
    metadata,
    resourceId,
    resourceType,
    userId,
  };
}
