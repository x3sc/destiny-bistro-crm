import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Calendar from 'react-native-calendars/src/calendar';
import type { DateData } from 'react-native-calendars/src/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocaleConfig from 'xdate';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { formatCentsAsBrl } from '../services/money';
import { exportStatementPdf } from '../services/statement-export';
import {
  defaultStatementEntryFilters,
  loadStatement,
  type StatementEntry,
  type StatementEntryFilters,
  type StatementMovementType,
  type StatementOrigin,
  type StatementOriginFilter,
  type StatementReport,
  type StatementView,
} from '../services/statements-api';
import { themeColors } from '../theme/tokens';
import { ScreenBackButton } from './screen-back-button';
import { statementStyles as styles } from './statements-screen.styles';

LocaleConfig.locales['pt-br'] = {
  dayNames: [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ],
  dayNamesShort: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  monthNames: [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ],
  monthNamesShort: [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

type ScreenState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { kind: 'success'; report: StatementReport };

const originLabels: Record<StatementOrigin, string> = {
  CREDIT_MANUAL: 'Fiado manual',
  CREDIT_TABLE: 'Fiado de mesa',
  TABLE: 'Mesa',
};

const statusLabels: Record<StatementEntry['status'], string> = {
  CANCELLED: 'Cancelada',
  CLOSED: 'Fechada',
  OPEN: 'Em aberto',
};

const paymentMethodLabels = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'Pix',
} as const;

const paymentSummaryLabels = {
  ...paymentMethodLabels,
  UNSPECIFIED: 'Não informado',
} as const;

const movementTypeOptions: {
  label: string;
  value: StatementMovementType;
}[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Vendas', value: 'SALES' },
  { label: 'Recebimentos', value: 'RECEIPTS' },
  { label: 'Cancelamentos', value: 'CANCELLATIONS' },
];

const originFilterOptions: {
  label: string;
  value: StatementOriginFilter;
}[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Mesa', value: 'TABLE' },
  { label: 'Fiado manual', value: 'CREDIT_MANUAL' },
  { label: 'Fiado de mesa', value: 'CREDIT_TABLE' },
];

export function StatementsScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  exportRequest = exportStatementPdf,
  loadRequest = loadStatement,
  onBack,
  title = 'Extratos',
  today = saoPauloToday(),
}: {
  apiBaseUrl?: string;
  exportRequest?: typeof exportStatementPdf;
  loadRequest?: typeof loadStatement;
  onBack: () => void;
  title?: string;
  today?: string;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [draftFrom, setDraftFrom] = useState(today);
  const [draftTo, setDraftTo] = useState<string | null>(today);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [view, setView] = useState<StatementView>('summary');
  const [expandedEntryId, setExpandedEntryId] = useState<string>();
  const [entryFilters, setEntryFilters] = useState<StatementEntryFilters>({
    ...defaultStatementEntryFilters,
  });

  const requestPeriod = useCallback(
    (from: string, to: string) => {
      const request = normalizedApiBaseUrl
        ? loadRequest(normalizedApiBaseUrl, from, to)
        : Promise.reject(new Error('API não configurada'));

      void request.then(
        (report) => setState({ kind: 'success', report }),
        () => setState({ kind: 'error' }),
      );
    },
    [loadRequest, normalizedApiBaseUrl],
  );

  useEffect(() => {
    requestPeriod(today, today);
  }, [requestPeriod, today]);

  const markedDates = useMemo(
    () => createPeriodMarkings(draftFrom, draftTo),
    [draftFrom, draftTo],
  );

  const selectDay = (day: DateData) => {
    const selected = day.dateString;
    if (draftTo !== null || selected < draftFrom) {
      setDraftFrom(selected);
      setDraftTo(null);
    } else {
      setDraftTo(selected);
    }
  };

  const applyPeriod = () => {
    if (!draftTo) {
      return;
    }

    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setExpandedEntryId(undefined);
    setExportError(false);
    setState({ kind: 'loading' });
    requestPeriod(draftFrom, draftTo);
  };

  const retry = () => {
    setState({ kind: 'loading' });
    requestPeriod(appliedFrom, appliedTo);
  };

  const exportPdf = () => {
    if (!normalizedApiBaseUrl || exporting) {
      return;
    }

    setExporting(true);
    setExportError(false);
    void exportRequest(
      normalizedApiBaseUrl,
      appliedFrom,
      appliedTo,
      view,
      view === 'detailed' ? entryFilters : defaultStatementEntryFilters,
    ).then(
      () => setExporting(false),
      () => {
        setExporting(false);
        setExportError(true);
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenBackButton onPress={onBack} />
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            Acompanhe vendas, recebimentos e comandas por período.
          </Text>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['summary', 'detailed'] as const).map((tabView) => {
            const selected = view === tabView;
            const label = tabView === 'summary' ? 'Resumido' : 'Detalhado';
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tabView}
                onPress={() => {
                  setView(tabView);
                  setExpandedEntryId(undefined);
                  setExportError(false);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  selected && styles.tabSelected,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.calendarCard}>
          <Calendar
            current={draftFrom}
            enableSwipeMonths
            firstDay={1}
            markedDates={markedDates}
            markingType="period"
            onDayPress={selectDay}
            testID="statement-calendar"
            theme={{
              arrowColor: themeColors.primary,
              calendarBackground: themeColors.surface,
              monthTextColor: themeColors.foreground,
              selectedDayBackgroundColor: themeColors.primary,
              todayTextColor: themeColors.primary,
            }}
          />
          <Text style={styles.period}>
            {formatDateKey(draftFrom)}
            {draftTo ? ` até ${formatDateKey(draftTo)}` : ' até ...'}
          </Text>
          <StatementButton
            disabled={!draftTo}
            label="Aplicar período"
            onPress={applyPeriod}
          />
        </View>

        {state.kind === 'loading' && (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.description}>Carregando extrato...</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={styles.actions}>
            <Text style={styles.error}>
              Não foi possível carregar o extrato selecionado.
            </Text>
            <StatementButton
              label="Tentar novamente"
              onPress={retry}
            />
          </View>
        )}

        {state.kind === 'success' && (
          <>
            {view === 'summary' ? (
              <StatementSummaryView report={state.report} />
            ) : (
              <StatementDetailedView
                filters={entryFilters}
                expandedEntryId={expandedEntryId}
                onFiltersChange={(filters) => {
                  setEntryFilters(filters);
                  setExpandedEntryId(undefined);
                }}
                onExpandedEntryChange={setExpandedEntryId}
                report={state.report}
              />
            )}

            <View style={styles.actions}>
              {exportError && (
                <Text style={styles.error}>
                  Não foi possível gerar ou compartilhar o PDF.
                </Text>
              )}
              <StatementButton
                disabled={exporting}
                label={exporting ? 'Gerando PDF...' : 'Exportar PDF'}
                onPress={exportPdf}
              />
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function StatementSummaryView({ report }: { report: StatementReport }) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumo do período</Text>
        <View style={styles.metrics}>
          <MetricCard label="Valor vendido" value={formatCentsAsBrl(report.summary.soldCents)} />
          <MetricCard label="Valor recebido" value={formatCentsAsBrl(report.summary.receivedCents)} />
          <MetricCard label="Diferença do período" value={formatCentsAsBrl(report.indicators.differenceCents)} />
          <MetricCard label="Ticket médio" value={formatCentsAsBrl(report.indicators.averageTicketCents)} />
          <MetricCard label="Comandas processadas" value={String(report.summary.processedCommandCount)} />
          <MetricCard label="Comandas com venda" value={String(report.indicators.saleCommandCount)} />
          <MetricCard label="Fechadas" value={String(report.summary.closedCommandCount)} />
          <MetricCard label="Canceladas" value={String(report.summary.cancelledCommandCount)} />
          <MetricCard label="Itens vendidos" value={String(report.summary.soldItemCount)} />
          <MetricCard label="Itens recebidos" value={String(report.summary.receivedItemCount)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recebimentos por forma de pagamento</Text>
        <View style={styles.metrics}>
          {report.indicators.paymentMethodSummaries.map((payment) => (
            <MetricCard
              key={payment.method}
              label={paymentSummaryLabels[payment.method]}
              value={formatCentsAsBrl(payment.receivedCents)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totais por origem</Text>
        {report.indicators.originSummaries.map((origin) => (
          <View key={origin.origin} style={styles.dailyCard}>
            <Text style={styles.dailyDate}>{originLabels[origin.origin]}</Text>
            <Text style={styles.dailyMeta}>
              Vendido {formatCentsAsBrl(origin.soldCents)} · Recebido{' '}
              {formatCentsAsBrl(origin.receivedCents)}
            </Text>
            <Text style={styles.dailyMeta}>
              {origin.movementCount} movimentações · {origin.soldItemCount} itens vendidos ·{' '}
              {origin.receivedItemCount} itens recebidos
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Totais diários</Text>
        {report.days.map((day) => (
          <View key={day.date} style={styles.dailyCard}>
            <Text style={styles.dailyDate}>{formatDateKey(day.date)}</Text>
            <Text style={styles.dailyMeta}>
              Vendido {formatCentsAsBrl(day.soldCents)} · Recebido{' '}
              {formatCentsAsBrl(day.receivedCents)}
            </Text>
            <Text style={styles.dailyMeta}>
              Itens: {day.soldItemCount} vendidos · {day.receivedItemCount} recebidos
            </Text>
            <Text style={styles.dailyMeta}>
              Comandas: {day.processedCommandCount} processadas · {day.closedCommandCount}{' '}
              fechadas · {day.cancelledCommandCount} canceladas
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function StatementDetailedView({
  expandedEntryId,
  filters,
  onFiltersChange,
  onExpandedEntryChange,
  report,
}: {
  expandedEntryId?: string;
  filters: StatementEntryFilters;
  onFiltersChange: (filters: StatementEntryFilters) => void;
  onExpandedEntryChange: (entryId: string | undefined) => void;
  report: StatementReport;
}) {
  const visibleEntries = filterEntries(report.entries, filters);
  const commandGroups = groupEntriesByCommand(visibleEntries);
  const filtersActive =
    filters.movementType !== 'ALL' || filters.origin !== 'ALL';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Linha do tempo</Text>
      <View style={styles.filterCard}>
        <StatementFilter
          label="Tipo"
          onChange={(movementType) =>
            onFiltersChange({ ...filters, movementType })
          }
          options={movementTypeOptions}
          selected={filters.movementType}
        />
        <StatementFilter
          label="Origem"
          onChange={(origin) => onFiltersChange({ ...filters, origin })}
          options={originFilterOptions}
          selected={filters.origin}
        />
        {filtersActive && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onFiltersChange({ ...defaultStatementEntryFilters })}
            style={({ pressed }) => [
              styles.clearFilters,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.clearFiltersText}>Limpar filtros</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.resultCount}>
        {formatResultCount(visibleEntries.length, commandGroups.length)}
      </Text>
      {visibleEntries.length === 0 ? (
        <Text style={styles.empty}>
          {filtersActive
            ? 'Nenhuma movimentação encontrada para os filtros selecionados.'
            : 'Nenhuma movimentação encontrada no período.'}
        </Text>
      ) : (
        commandGroups.map((entries) => {
          const command = entries[0];
          return (
            <View key={command.comandaId} style={styles.commandCard}>
              <View style={styles.commandHeader}>
                <Text style={styles.commandTitle}>Comanda #{command.comandaNumber}</Text>
                {(command.customerName || command.comandaName) && (
                  <Text style={styles.commandName}>
                    {command.customerName ?? command.comandaName}
                  </Text>
                )}
                <Text style={styles.dailyMeta}>
                  {commandLocation(command)} · {originLabels[command.origin]} ·{' '}
                  {statusLabels[command.status]}
                </Text>
              </View>
              <View style={styles.timeline}>
                {entries.map((entry, index) => (
                  <View key={entry.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {index < entries.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <StatementEntryCard
                      entry={entry}
                      expanded={expandedEntryId === entry.id}
                      onToggle={() =>
                        onExpandedEntryChange(
                          expandedEntryId === entry.id ? undefined : entry.id,
                        )
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function StatementFilter<T extends string>({
  label,
  onChange,
  options,
  selected,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  selected: T;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              accessibilityLabel={`Filtrar ${label.toLocaleLowerCase('pt-BR')}: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipSelected,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StatementEntryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: StatementEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const presentation = entryPresentation(entry);
  return (
    <View style={styles.entryCard}>
      <Pressable
        accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} etapa ${presentation.title} da comanda ${entry.comandaNumber}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [styles.entryHeader, pressed && styles.buttonPressed]}
      >
        <View style={styles.entryHeaderCopy}>
          <Text style={styles.entryTitle}>{presentation.title}</Text>
          <Text style={styles.dailyMeta}>{formatStatementDateTime(entry.occurredAt)}</Text>
          {presentation.rows.map((row) => (
            <Text key={row.label} style={styles.financialDescription}>
              {row.label}: {formatCentsAsBrl(row.valueCents)}
            </Text>
          ))}
          {presentation.note && (
            <Text style={styles.financialDescription}>{presentation.note}</Text>
          )}
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.entryBody}>
          {entry.receivedCents > 0 && (
            <View>
              <Text style={styles.itemsTitle}>Formas de pagamento</Text>
              {entry.payments.length === 0 ? (
                <Text style={styles.dailyMeta}>Forma de pagamento não informada</Text>
              ) : (
                entry.payments.map((payment) => (
                  <Text key={payment.method} style={styles.dailyMeta}>
                    {paymentMethodLabels[payment.method]} ·{' '}
                    {formatCentsAsBrl(payment.amountCents)}
                  </Text>
                ))
              )}
            </View>
          )}
          <Text style={styles.itemsTitle}>Produtos desta etapa</Text>
          {entry.items.length === 0 ? (
            <Text style={styles.empty}>Nenhum item associado a esta movimentação.</Text>
          ) : (
            entry.items.map((item) => (
              <View
                key={`${item.productId}:${item.unitPriceCents}`}
                style={styles.itemRow}
              >
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.dailyMeta}>
                  {item.quantity} × {formatCentsAsBrl(item.unitPriceCents)} ={' '}
                  {formatCentsAsBrl(item.quantity * item.unitPriceCents)}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function filterEntries(
  entries: StatementEntry[],
  filters: StatementEntryFilters,
) {
  return entries.filter((entry) => {
    const matchesType =
      filters.movementType === 'ALL' ||
      (filters.movementType === 'SALES' && entry.soldCents > 0) ||
      (filters.movementType === 'RECEIPTS' && entry.receivedCents > 0) ||
      (filters.movementType === 'CANCELLATIONS' &&
        entry.event === 'COMANDA_CANCELLED');
    return (
      matchesType &&
      (filters.origin === 'ALL' || entry.origin === filters.origin)
    );
  });
}

function groupEntriesByCommand(entries: StatementEntry[]) {
  const groups = new Map<string, StatementEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.comandaId) ?? [];
    group.push(entry);
    groups.set(entry.comandaId, group);
  }
  return [...groups.values()];
}

function commandLocation(entry: StatementEntry) {
  if (entry.tableNumber !== null) {
    return `Mesa ${entry.tableNumber}`;
  }
  return entry.customerName ? `Cliente ${entry.customerName}` : 'Sem mesa';
}

function entryPresentation(entry: StatementEntry): {
  note?: string;
  rows: { label: string; valueCents: number }[];
  title: string;
} {
  const total = entry.creditTotalCents ?? entry.soldCents;
  const open = entry.creditBalanceAfterCents ?? 0;
  const paid = entry.creditPaidAfterCents ?? entry.receivedCents;

  if (entry.event === 'COMANDA_CANCELLED') {
    return {
      note: 'Sem impacto nas vendas e recebimentos.',
      rows: [],
      title: 'Comanda cancelada',
    };
  }
  if (entry.event === 'TABLE_CLOSED') {
    return {
      rows: [
        { label: 'Total', valueCents: entry.soldCents },
        { label: 'Valor pago', valueCents: entry.receivedCents },
      ],
      title: 'Comanda paga',
    };
  }
  if (
    entry.event === 'CREDIT_FINALIZED' &&
    entry.origin === 'CREDIT_TABLE' &&
    (entry.tableCheckoutPaidCents ?? 0) > 0
  ) {
    return {
      rows: [
        { label: 'Valor pago', valueCents: entry.tableCheckoutPaidCents ?? 0 },
        { label: 'Valor fiado', valueCents: open },
      ],
      title: 'Comanda paga parcialmente',
    };
  }
  if (
    entry.event === 'CREDIT_FINALIZED' ||
    entry.paymentOrigin === 'TABLE_CHECKOUT'
  ) {
    return {
      rows: [
        { label: 'Total', valueCents: total },
        { label: 'Valor aberto', valueCents: open },
        { label: 'Valor já pago', valueCents: paid },
      ],
      title: 'Fiado aberto',
    };
  }
  if (entry.event === 'CREDIT_SETTLED') {
    const previousPayment =
      entry.origin === 'CREDIT_TABLE'
        ? (entry.tableCheckoutPaidCents ?? 0)
        : (entry.creditPaidBeforeCents ?? 0);
    return {
      rows: [
        { label: 'Total', valueCents: total },
        { label: 'Pago do fiado', valueCents: entry.receivedCents },
        {
          label:
            entry.origin === 'CREDIT_TABLE'
              ? 'Valor pago na comanda anterior'
              : 'Valor pago anteriormente',
          valueCents: previousPayment,
        },
      ],
      title: 'Fiado fechado',
    };
  }
  return {
    rows: [
      { label: 'Total', valueCents: total },
      { label: 'Valor aberto', valueCents: open },
      { label: 'Valor já pago', valueCents: paid },
    ],
    title:
      entry.event === 'CREDIT_ADDITION'
        ? 'Novo valor adicionado ao fiado'
        : 'Fiado pago parcialmente',
  };
}

function formatResultCount(entryCount: number, commandCount: number) {
  return `${entryCount} ${entryCount === 1 ? 'etapa' : 'etapas'} em ${commandCount} ${
    commandCount === 1 ? 'comanda' : 'comandas'
  }`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function StatementButton({
  disabled = false,
  label,
  onPress,
  tone = 'primary',
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'secondary' && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === 'secondary' && styles.buttonSecondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createPeriodMarkings(from: string, to: string | null) {
  const markings: Record<
    string,
    {
      color: string;
      endingDay?: boolean;
      startingDay?: boolean;
      textColor: string;
    }
  > = {};
  const end = to ?? from;
  let date = from;

  while (date <= end) {
    markings[date] = {
      color: themeColors.primary,
      endingDay: date === end,
      startingDay: date === from,
      textColor: themeColors.foregroundOnPrimary,
    };
    date = addDays(date, 1);
  }

  return markings;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatStatementDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(new Date(value));
}

function saoPauloToday() {
  const values = new Map(
    new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}
