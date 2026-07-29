import { exportStatementPdf } from '../statement-export';

it('downloads the authenticated PDF on web', async () => {
  const downloadWeb = jest.fn(() => Promise.resolve());
  const downloadAndShare = jest.fn(() => Promise.resolve());

  await exportStatementPdf(
    'http://localhost:3333',
    '2026-07-28',
    '2026-07-30',
    {
      downloadAndShare,
      downloadWeb,
      platform: 'web',
    },
  );

  expect(downloadWeb).toHaveBeenCalledWith(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30',
    'extrato-2026-07-28-a-2026-07-30.pdf',
  );
  expect(downloadAndShare).not.toHaveBeenCalled();
});

it('downloads and shares the PDF on native platforms', async () => {
  const downloadWeb = jest.fn(() => Promise.resolve());
  const downloadAndShare = jest.fn(() => Promise.resolve());

  await exportStatementPdf(
    'http://localhost:3333',
    '2026-07-28',
    '2026-07-30',
    {
      downloadAndShare,
      downloadWeb,
      platform: 'android',
    },
  );

  expect(downloadAndShare).toHaveBeenCalledWith(
    'http://localhost:3333/statements/export.pdf?from=2026-07-28&to=2026-07-30',
    'extrato-2026-07-28-a-2026-07-30.pdf',
    null,
  );
  expect(downloadWeb).not.toHaveBeenCalled();
});
