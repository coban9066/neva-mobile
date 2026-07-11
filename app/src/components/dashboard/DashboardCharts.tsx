import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { select } from "@/lib/db";
import { formatKurus } from "@/lib/money";

interface MonthlyRow {
  ym: string;
  profit: number;
}

interface DailyRow {
  d: string;
  profit: number;
}

const MONTH_LABELS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

const compactLira = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

/** Y ekseni etiketi: dar eksen genişliğinde tam tutar sığmadığı için kısaltılmış gösterim. */
function formatAxisLira(lira: number) {
  return lira === 0 ? "0" : compactLira.format(lira);
}

const CHART_MONTHS = 6;
const MIN_CHART_MONTHS = 3;

/**
 * Son 6 aylık pencereyi oluşturur, ancak henüz o kadar geçmişi olmayan
 * (yeni başlayan) işletmelerde grafiği anlamsızca boş aylarla doldurmak yerine
 * ilk satıştan bugüne kadar olan aralığı gösterir (en az MIN_CHART_MONTHS ay).
 */
function lastNMonths(rows: MonthlyRow[]) {
  const byYm = new Map(rows.map((r) => [r.ym, r.profit]));
  const now = new Date();
  const full: { label: string; ym: string; profit: number }[] = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    full.push({ label: MONTH_LABELS[d.getMonth()], ym, profit: (byYm.get(ym) ?? 0) / 100 });
  }
  const firstDataIdx = full.findIndex((m) => byYm.has(m.ym));
  const start = firstDataIdx === -1 ? full.length - MIN_CHART_MONTHS : Math.min(firstDataIdx, full.length - MIN_CHART_MONTHS);
  return full.slice(Math.max(0, start));
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-fg-muted">{label}</p>
      <p className="tabular font-mono font-semibold text-fg">{formatKurus(payload[0].value * 100)}</p>
    </div>
  );
}

/** Dashboard kâr grafikleri: son 6 ay (sütun) + bu ay günlük (çizgi). Sade, bilgi odaklı. */
export function DashboardCharts() {
  const { data: monthly = [] } = useQuery({
    queryKey: ["dashboard-chart-monthly"],
    queryFn: () =>
      select<MonthlyRow>(
        `SELECT strftime('%Y-%m', sale_date) AS ym, SUM(net_profit) AS profit
         FROM v_phone_profit
         WHERE sale_date >= date('now','localtime','-5 months','start of month')
         GROUP BY ym ORDER BY ym`
      ),
  });

  const { data: daily = [] } = useQuery({
    queryKey: ["dashboard-chart-daily"],
    queryFn: () =>
      select<DailyRow>(
        `SELECT date(sale_date) AS d, SUM(net_profit) AS profit
         FROM v_phone_profit
         WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m','now','localtime')
         GROUP BY d ORDER BY d`
      ),
  });

  const monthlyData = lastNMonths(monthly);
  const monthlyTitle =
    monthlyData.length >= CHART_MONTHS ? `Son ${CHART_MONTHS} Ay Kâr` : `Son ${monthlyData.length} Ay Kâr`;
  const dailyData = daily.map((r) => ({
    label: r.d.slice(8, 10),
    profit: r.profit / 100,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[13px] font-semibold">{monthlyTitle}</h2>
        <div className="mt-2 h-[260px]">
          {monthly.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-fg-muted">
              Henüz kâr verisi yok. İlk satıştan sonra burada trend görünecek.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={formatAxisLira}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-border)", opacity: 0.4 }} />
                <Bar dataKey="profit" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[13px] font-semibold">Bu Ay Günlük Kâr</h2>
        <div className="mt-2 h-[260px]">
          {dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-fg-muted">
              Bu ay henüz satış yok.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={formatAxisLira}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border)" }} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
