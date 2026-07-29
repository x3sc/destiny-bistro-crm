import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { statementPdfUrl } from './statements-api';

export async function exportStatementPdf(
  apiBaseUrl: string,
  from: string,
  to: string,
  runtime: StatementExportRuntime = defaultRuntime,
) {
  const url = statementPdfUrl(apiBaseUrl, from, to);

  if (runtime.platform === 'web') {
    await runtime.openWeb(url);
    return;
  }

  const filename = `extrato-${from}-a-${to}.pdf`;
  await runtime.downloadAndShare(url, filename);
}

interface StatementExportRuntime {
  downloadAndShare: (url: string, filename: string) => Promise<void>;
  openWeb: (url: string) => Promise<unknown>;
  platform: string;
}

const defaultRuntime: StatementExportRuntime = {
  downloadAndShare,
  openWeb: (url) => Linking.openURL(url),
  platform: Platform.OS,
};

async function downloadAndShare(url: string, filename: string) {
  const destination = new File(Paths.cache, filename);
  if (destination.exists) {
    destination.delete();
  }

  const file = await File.downloadFileAsync(url, destination);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Exportar extrato',
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}
