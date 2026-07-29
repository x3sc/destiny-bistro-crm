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
  entries: [],
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
    );
  });
});
