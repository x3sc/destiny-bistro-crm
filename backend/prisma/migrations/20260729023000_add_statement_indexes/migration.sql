CREATE INDEX `Comanda_status_closedAt_idx`
  ON `Comanda`(`status`, `closedAt`);

CREATE INDEX `Comanda_status_cancelledAt_idx`
  ON `Comanda`(`status`, `cancelledAt`);

CREATE INDEX `CreditOrder_status_finalizedAt_idx`
  ON `CreditOrder`(`status`, `finalizedAt`);

CREATE INDEX `CreditSettlement_paidAt_idx`
  ON `CreditSettlement`(`paidAt`);

CREATE INDEX `ComandaEvent_type_createdAt_idx`
  ON `ComandaEvent`(`type`, `createdAt`);
