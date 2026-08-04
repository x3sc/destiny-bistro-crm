import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { StatementReport } from '../../services/statements-api';
import { StatementsScreen } from '../statements-screen';

const statement: StatementReport = {
  days: [
    {
      cancelledCommandCount: 1,
      closedCommandCount: 1,
      date: '2026-07-28',
      processedCommandCount: 2,
      receivedCents: 2000,
      receivedItemCount: 2,
      soldCents: 2500,
      soldItemCount: 3,
    },
  ],
  entries: [
    {
      comandaId: 'comanda-id',
      comandaName: 'Almoço',
      comandaNumber: 42,
      creditBalanceAfterCents: null,
      creditPaidAfterCents: null,
      creditPaidBeforeCents: null,
      creditTotalCents: null,
      customerName: null,
      event: 'TABLE_CLOSED',
      id: 'entry-id',
      items: [
        {
          productId: 'product-id',
          productName: 'Café',
          quantity: 2,
          unitPriceCents: 500,
        },
      ],
      occurredAt: '2026-07-28T13:00:00.000Z',
      origin: 'TABLE',
      payments: [],
      paymentOrigin: null,
      receivedCents: 1000,
      receivedItemCount: 2,
      soldCents: 1000,
      soldItemCount: 2,
      status: 'CLOSED',
      tableNumber: 3,
      tableCheckoutPaidCents: null,
    },
    {
      comandaId: 'credit-id',
      comandaName: 'Maria',
      comandaNumber: 43,
      creditBalanceAfterCents: 1500,
      creditPaidAfterCents: 0,
      creditPaidBeforeCents: 0,
      creditTotalCents: 1500,
      customerName: 'Maria',
      event: 'CREDIT_FINALIZED',
      id: 'credit-entry-id',
      items: [
        {
          productId: 'juice-id',
          productName: 'Suco',
          quantity: 1,
          unitPriceCents: 1500,
        },
      ],
      occurredAt: '2026-07-28T14:00:00.000Z',
      origin: 'CREDIT_MANUAL',
      payments: [],
      paymentOrigin: null,
      receivedCents: 0,
      receivedItemCount: 0,
      soldCents: 1500,
      soldItemCount: 1,
      status: 'OPEN',
      tableNumber: null,
      tableCheckoutPaidCents: 0,
    },
  ],
  indicators: {
    averageTicketCents: 1250,
    differenceCents: 500,
    originSummaries: [
      {
        movementCount: 1,
        origin: 'TABLE',
        receivedCents: 1000,
        receivedItemCount: 2,
        soldCents: 1000,
        soldItemCount: 2,
      },
      {
        movementCount: 1,
        origin: 'CREDIT_MANUAL',
        receivedCents: 1000,
        receivedItemCount: 0,
        soldCents: 1500,
        soldItemCount: 1,
      },
      {
        movementCount: 0,
        origin: 'CREDIT_TABLE',
        receivedCents: 0,
        receivedItemCount: 0,
        soldCents: 0,
        soldItemCount: 0,
      },
    ],
    paymentMethodSummaries: [
      { method: 'CASH', receivedCents: 500 },
      { method: 'PIX', receivedCents: 400 },
      { method: 'DEBIT_CARD', receivedCents: 300 },
      { method: 'CREDIT_CARD', receivedCents: 200 },
      { method: 'UNSPECIFIED', receivedCents: 600 },
    ],
    saleCommandCount: 2,
  },
  period: {
    from: '2026-07-28',
    timeZone: 'America/Sao_Paulo',
    to: '2026-07-28',
  },
  summary: {
    cancelledCommandCount: 1,
    closedCommandCount: 1,
    processedCommandCount: 2,
    receivedCents: 2000,
    receivedItemCount: 2,
    soldCents: 2500,
    soldItemCount: 3,
  },
};

it('loads today and shows financial, command and item summaries', async () => {
  const loadRequest = jest.fn(() => Promise.resolve(statement));

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={jest.fn()}
      loadRequest={loadRequest}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  expect(await screen.findByText('R$ 25,00')).toBeTruthy();
  expect(screen.getByText('R$ 20,00')).toBeTruthy();
  expect(screen.getByText('Comandas processadas')).toBeTruthy();
  expect(screen.getByText('Itens vendidos')).toBeTruthy();
  expect(screen.getByText('Itens recebidos')).toBeTruthy();
  expect(screen.getByText('Diferença do período')).toBeTruthy();
  expect(screen.getByText('Ticket médio')).toBeTruthy();
  expect(screen.getByText('Totais por origem')).toBeTruthy();
  expect(screen.getByText('Recebimentos por forma de pagamento')).toBeTruthy();
  expect(screen.getByText('Dinheiro')).toBeTruthy();
  expect(screen.getByText('Pix')).toBeTruthy();
  expect(screen.getByText('Cartão de débito')).toBeTruthy();
  expect(screen.getByText('Cartão de crédito')).toBeTruthy();
  expect(screen.getByText('Não informado')).toBeTruthy();
  expect(screen.getAllByText('R$ 5,00')).toHaveLength(2);
  expect(screen.getByText('R$ 4,00')).toBeTruthy();
  expect(screen.getByText('R$ 3,00')).toBeTruthy();
  expect(screen.getByText('R$ 2,00')).toBeTruthy();
  expect(screen.getByText('R$ 6,00')).toBeTruthy();
  expect(screen.getByText('28/07/2026')).toBeTruthy();
  expect(loadRequest).toHaveBeenCalledWith(
    'http://localhost:3333',
    '2026-07-28',
    '2026-07-28',
  );
});

it('applies a range from one calendar and exports the selected period', async () => {
  const loadRequest = jest.fn(() => Promise.resolve(statement));
  const exportRequest = jest.fn(() => Promise.resolve());

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={exportRequest}
      loadRequest={loadRequest}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  await screen.findByText('R$ 25,00');
  fireEvent.press(
    screen.getByTestId('statement-calendar.day_2026-07-29'),
  );
  fireEvent.press(
    screen.getByTestId('statement-calendar.day_2026-07-30'),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));

  await waitFor(() => {
    expect(loadRequest).toHaveBeenLastCalledWith(
      'http://localhost:3333',
      '2026-07-29',
      '2026-07-30',
    );
  });

  fireEvent.press(screen.getByRole('button', { name: 'Exportar PDF' }));
  await waitFor(() => {
    expect(exportRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      '2026-07-29',
      '2026-07-30',
      'summary',
      { movementType: 'ALL', origin: 'ALL' },
    );
  });
});

it('groups a contextual timeline by comanda and expands only one stage', async () => {
  const loadRequest = jest.fn(() => Promise.resolve(statement));

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={jest.fn()}
      loadRequest={loadRequest}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  await screen.findByText('Totais por origem');
  expect(
    screen.getByRole('tab', { name: 'Resumido' }).props.accessibilityState,
  ).toEqual({ selected: true });

  fireEvent.press(screen.getByRole('tab', { name: 'Detalhado' }));
  expect(loadRequest).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Café')).toBeNull();
  expect(screen.getByText('2 etapas em 2 comandas')).toBeTruthy();
  expect(screen.getByText('Comanda paga')).toBeTruthy();
  expect(screen.getByText('Fiado aberto')).toBeTruthy();
  expect(screen.getByText('Total: R$ 15,00')).toBeTruthy();
  expect(screen.getByText('Valor aberto: R$ 15,00')).toBeTruthy();
  expect(screen.getByText('Valor já pago: R$ 0,00')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Expandir etapa Comanda paga da comanda 42',
    }),
  );
  expect(screen.getByText('Café')).toBeTruthy();
  expect(screen.getByText('2 × R$ 5,00 = R$ 10,00')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Expandir etapa Fiado aberto da comanda 43',
    }),
  );
  expect(screen.queryByText('Café')).toBeNull();
  expect(screen.getByText('Suco')).toBeTruthy();
});

it('explains a partially paid table comanda from checkout through settlement', async () => {
  const creditEntry = statement.entries[1];
  const report: StatementReport = {
    ...statement,
    entries: [
      {
        ...creditEntry,
        comandaNumber: 218,
        creditBalanceAfterCents: 9300,
        creditPaidAfterCents: 3000,
        creditPaidBeforeCents: 0,
        creditTotalCents: 12300,
        id: 'partially-paid-checkout',
        origin: 'CREDIT_TABLE',
        soldCents: 12300,
        tableCheckoutPaidCents: 3000,
      },
      {
        ...creditEntry,
        comandaNumber: 218,
        creditBalanceAfterCents: 9300,
        creditPaidAfterCents: 3000,
        creditPaidBeforeCents: 0,
        creditTotalCents: 12300,
        event: 'CREDIT_PAYMENT',
        id: 'opened-credit',
        items: [],
        occurredAt: '2026-07-28T14:00:00.000Z',
        origin: 'CREDIT_TABLE',
        paymentOrigin: 'TABLE_CHECKOUT',
        payments: [{ amountCents: 3000, method: 'PIX' }],
        receivedCents: 3000,
        soldCents: 0,
        soldItemCount: 0,
        tableCheckoutPaidCents: 3000,
      },
      {
        ...creditEntry,
        comandaNumber: 218,
        creditBalanceAfterCents: 0,
        creditPaidAfterCents: 12300,
        creditPaidBeforeCents: 3000,
        creditTotalCents: 12300,
        event: 'CREDIT_SETTLED',
        id: 'closed-credit',
        items: [],
        occurredAt: '2026-07-28T14:16:00.000Z',
        origin: 'CREDIT_TABLE',
        paymentOrigin: 'CREDIT_INSTALLMENT',
        payments: [{ amountCents: 9300, method: 'CASH' }],
        receivedCents: 9300,
        soldCents: 0,
        soldItemCount: 0,
        status: 'CLOSED',
        tableCheckoutPaidCents: 3000,
      },
    ],
  };

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={jest.fn()}
      loadRequest={jest.fn(() => Promise.resolve(report))}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  await screen.findByText('Totais por origem');
  fireEvent.press(screen.getByRole('tab', { name: 'Detalhado' }));

  expect(screen.getByText('Comanda paga parcialmente')).toBeTruthy();
  expect(screen.getByText('Valor pago: R$ 30,00')).toBeTruthy();
  expect(screen.getByText('Valor fiado: R$ 93,00')).toBeTruthy();
  expect(screen.getByText('Fiado aberto')).toBeTruthy();
  expect(screen.getAllByText('Total: R$ 123,00')).toHaveLength(2);
  expect(screen.getByText('Valor aberto: R$ 93,00')).toBeTruthy();
  expect(screen.getByText('Valor já pago: R$ 30,00')).toBeTruthy();
  expect(screen.getByText('Fiado fechado')).toBeTruthy();
  expect(screen.getByText('Pago do fiado: R$ 93,00')).toBeTruthy();
  expect(
    screen.getByText('Valor pago na comanda anterior: R$ 30,00'),
  ).toBeTruthy();
});

it('filters timeline stages, clears filters and exports the detailed selection', async () => {
  const creditEntry = statement.entries[1];
  const filteredStatement: StatementReport = {
    ...statement,
    entries: [
      ...statement.entries,
      {
        ...creditEntry,
        creditBalanceAfterCents: 1000,
        creditPaidAfterCents: 500,
        creditPaidBeforeCents: 0,
        event: 'CREDIT_PAYMENT',
        id: 'partial-payment',
        items: [],
        occurredAt: '2026-07-28T15:00:00.000Z',
        payments: [{ amountCents: 500, method: 'PIX' }],
        paymentOrigin: 'CREDIT_INSTALLMENT',
        receivedCents: 500,
        soldCents: 0,
        soldItemCount: 0,
      },
      {
        ...creditEntry,
        creditBalanceAfterCents: 0,
        creditPaidAfterCents: 1500,
        creditPaidBeforeCents: 500,
        event: 'CREDIT_SETTLED',
        id: 'final-payment',
        items: [],
        occurredAt: '2026-07-28T16:00:00.000Z',
        payments: [{ amountCents: 1000, method: 'CASH' }],
        paymentOrigin: 'CREDIT_INSTALLMENT',
        receivedCents: 1000,
        soldCents: 0,
        soldItemCount: 0,
        status: 'CLOSED',
      },
    ],
  };
  const exportRequest = jest.fn(() => Promise.resolve());

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={exportRequest}
      loadRequest={jest.fn(() => Promise.resolve(filteredStatement))}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  await screen.findByText('Totais por origem');
  fireEvent.press(screen.getByRole('tab', { name: 'Detalhado' }));
  expect(screen.getByText('4 etapas em 2 comandas')).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', {
      name: 'Expandir etapa Fiado pago parcialmente da comanda 43',
    }),
  );
  expect(screen.getByText('Formas de pagamento')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Filtrar tipo: Recebimentos' }));
  expect(screen.queryByText('Formas de pagamento')).toBeNull();
  expect(screen.getByText('3 etapas em 2 comandas')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Filtrar origem: Fiado manual' }));
  expect(screen.getByText('2 etapas em 1 comanda')).toBeTruthy();
  expect(screen.queryByText('Fiado aberto')).toBeNull();
  expect(screen.getByText('Fiado pago parcialmente')).toBeTruthy();
  expect(screen.getByText('Fiado fechado')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Exportar PDF' }));
  await waitFor(() => {
    expect(exportRequest).toHaveBeenCalledWith(
      'http://localhost:3333',
      '2026-07-28',
      '2026-07-28',
      'detailed',
      { movementType: 'RECEIPTS', origin: 'CREDIT_MANUAL' },
    );
  });

  fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByText('4 etapas em 2 comandas')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Filtrar tipo: Cancelamentos' }));
  expect(
    screen.getByText('Nenhuma movimentação encontrada para os filtros selecionados.'),
  ).toBeTruthy();
});

it('shows empty states for periods and movements without products', async () => {
  const reportWithoutProducts: StatementReport = {
    ...statement,
    entries: [{ ...statement.entries[0], items: [] }],
  };
  const { unmount } = render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={jest.fn()}
      loadRequest={jest.fn(() => Promise.resolve(reportWithoutProducts))}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );

  await screen.findByText('Totais por origem');
  fireEvent.press(screen.getByRole('tab', { name: 'Detalhado' }));
  fireEvent.press(
    screen.getByRole('button', {
      name: 'Expandir etapa Comanda paga da comanda 42',
    }),
  );
  expect(screen.getByText('Nenhum item associado a esta movimentação.')).toBeTruthy();
  unmount();

  render(
    <StatementsScreen
      apiBaseUrl="http://localhost:3333"
      exportRequest={jest.fn()}
      loadRequest={jest.fn(() => Promise.resolve({ ...statement, entries: [] }))}
      onBack={jest.fn()}
      today="2026-07-28"
    />,
  );
  await screen.findByText('Totais por origem');
  fireEvent.press(screen.getByRole('tab', { name: 'Detalhado' }));
  expect(screen.getByText('Nenhuma movimentação encontrada no período.')).toBeTruthy();
});
