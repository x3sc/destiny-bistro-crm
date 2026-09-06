export const kitchenTicketStatuses = [
  "PENDING",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type KitchenTicketStatus = (typeof kitchenTicketStatuses)[number];

export interface KitchenTicketItemAdditional {
  additionalId: string;
  additionalName: string;
  id: string;
  quantityPerUnit: number;
}

export interface KitchenTicketItemConfiguration {
  additionals: KitchenTicketItemAdditional[];
  configurationKey: string;
  id: string;
  quantity: number;
}

export interface KitchenTicketItem {
  comandaItemId: string;
  configurations: KitchenTicketItemConfiguration[];
  id: string;
  productId: string;
  productName: string;
  quantity: number;
}

export interface KitchenTicket {
  comandaId: string;
  comandaNumber: number;
  createdAt: string;
  id: string;
  items: KitchenTicketItem[];
  status: KitchenTicketStatus;
  table: {
    id: number;
    number: number;
  } | null;
  updatedAt: string;
}

export interface KitchenRepository {
  findById(establishmentId: string, ticketId: string): Promise<KitchenTicket>;
  listOperational(establishmentId: string): Promise<KitchenTicket[]>;
  updateStatus(
    establishmentId: string,
    ticketId: string,
    status: KitchenTicketStatus,
    actorUserId: string,
  ): Promise<KitchenTicket>;
}

export class KitchenTicketNotFoundError extends Error {}
export class KitchenTicketStatusConflictError extends Error {}

export function isKitchenTicketStatus(
  value: unknown,
): value is KitchenTicketStatus {
  return kitchenTicketStatuses.includes(value as KitchenTicketStatus);
}

export function canTransitionKitchenTicket(
  previousStatus: KitchenTicketStatus,
  nextStatus: KitchenTicketStatus,
) {
  if (previousStatus === nextStatus) {
    return true;
  }
  if (
    nextStatus === "CANCELLED" &&
    ["PENDING", "PREPARING", "READY"].includes(previousStatus)
  ) {
    return true;
  }
  return (
    (previousStatus === "PENDING" && nextStatus === "PREPARING") ||
    (previousStatus === "PREPARING" && nextStatus === "READY") ||
    (previousStatus === "READY" && nextStatus === "DELIVERED")
  );
}
