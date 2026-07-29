import { exportStatementPdf } from '../statement-export';

it('opens the PDF endpoint directly on web', async () => {
  const openWeb = jest.fn(() => Promise.resolve());
  const downloadAndShare = jest.fn(() => Promise.resolve());

  await exportStatementPdf(
    'http://localhost:3333',
    '2026-07-28',
    '2026-07-30',
    {
      downloadAndShare,
      openWeb,
      platform: 'web',
    },
  );

  expect(openWeb).toHaveBeenCalledWith(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30',
  );
  expect(downloadAndShare).not.toHaveBeenCalled();
});

it('downloads and shares the PDF on native platforms', async () => {
  const openWeb = jest.fn(() => Promise.resolve());
  const downloadAndShare = jest.fn(() => Promise.resolve());

  await exportStatementPdf(
    'http://localhost:3333',
    '2026-07-28',
    '2026-07-30',
    {
      downloadAndShare,
      openWeb,
      platform: 'android',
    },
  );

  expect(downloadAndShare).toHaveBeenCalledWith(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30',
    'extrato-2026-07-28-a-2026-07-30.pdf',
  );
  expect(openWeb).not.toHaveBeenCalled();
});
