ALTER TABLE `Delivery`
  ADD CONSTRAINT `Delivery_amounts_valid`
    CHECK (
      `totalCents` > 0
      AND `feeCents` >= 0
      AND `feeCents` <= `totalCents`
    );
