import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpFromLine,
  CalendarDays,
  Smartphone,
  PiggyBank,
  Wallet,
  Layers,
  ShieldCheck,
  Award,
} from "lucide-react";
import { selectOne, select } from "@/lib/db";
import { formatKurus } from "@/lib/money";
import { DashboardCard, type CardTone } from "@/components/dashboard/DashboardCard";
import { QuickProfitCalculator } from "@/components/dashboard/QuickProfitCalculator";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

interface Kpis {
  today_sales_count: number;
  today_sales_total: number | null;
  month_sales_count: number;
  month_sales_total: number | null;
  stock_count: number;
  month_profit: number | null;
  cash_balance: number | null;
  total_phones: number;
  total_profit: number | null;
  pending_warranty: number;
}

interface TopBrandRow {
  brand: string;
  sold: number;
}

function profitTone(v: number | null | undefined): CardTone {
  if (v == null || v === 0) return "default";
  return v > 0 ? "success" : "danger";
}

/** Operasyon ekranı: yalnız gerçekleşmiş veriler — tahmini/yanıltıcı metrik yok. */
export function DashboardPage() {
  const navigate = useNavigate();

  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () =>
      selectOne<Kpis>(
        `SELECT
          (SELECT COUNT(*) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS today_sales_count,
          (SELECT SUM(price) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS today_sales_total,
          (SELECT COUNT(*) FROM sales WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now','localtime') AND deleted_at IS NULL) AS month_sales_count,
          (SELECT SUM(price) FROM sales WHERE strftime('%Y-%m',date)=strftime('%Y-%m','now','localtime') AND deleted_at IS NULL) AS month_sales_total,
          (SELECT phone_count FROM v_stock_value) AS stock_count,
          (SELECT SUM(net_profit) FROM v_phone_profit
             WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now', 'localtime')) AS month_profit,
          (SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END)
             FROM till_entries WHERE method = 'cash') AS cash_balance,
          (SELECT COUNT(*) FROM phones WHERE deleted_at IS NULL) AS total_phones,
          (SELECT SUM(net_profit) FROM v_phone_profit) AS total_profit,
          (SELECT COUNT(*) FROM phones
             WHERE deleted_at IS NULL AND warranty_until IS NOT NULL
               AND date(warranty_until) >= date('now','localtime')) AS pending_warranty`
      ),
  });

  const { data: topBrand } = useQuery({
    queryKey: ["dashboard-top-brand"],
    queryFn: async () => {
      const rows = await select<TopBrandRow>(
        `SELECT COALESCE(b.name, 'Diğer') AS brand, COUNT(*) AS sold
         FROM sales s
         JOIN phones p ON p.id = s.phone_id
         LEFT JOIN brands b ON b.id = p.brand_id
         WHERE s.deleted_at IS NULL
         GROUP BY brand ORDER BY sold DESC LIMIT 1`
      );
      return rows[0] ?? null;
    },
  });

  const cards = [
    {
      icon: ArrowUpFromLine,
      label: "Bugünkü Satış",
      value: formatKurus(kpis?.today_sales_total ?? 0),
      unit: `${kpis?.today_sales_count ?? 0} adet`,
      to: "/satislar",
    },
    {
      icon: CalendarDays,
      label: "Bu Ayki Satış",
      value: formatKurus(kpis?.month_sales_total ?? 0),
      unit: `${kpis?.month_sales_count ?? 0} adet`,
      to: "/satislar",
    },
    {
      icon: Smartphone,
      label: "Stoktaki Telefon",
      value: String(kpis?.stock_count ?? 0),
      unit: "adet",
      to: "/telefonlar",
    },
    {
      icon: PiggyBank,
      label: "Bu Ay Net Kar",
      value: formatKurus(kpis?.month_profit ?? 0),
      tone: profitTone(kpis?.month_profit),
      to: "/kasa",
    },
    {
      icon: Wallet,
      label: "Kasadaki Nakit",
      value: formatKurus(kpis?.cash_balance ?? 0),
      to: "/kasa",
    },
    {
      icon: Layers,
      label: "Toplam Telefon",
      value: String(kpis?.total_phones ?? 0),
      unit: "adet",
      to: "/telefonlar",
    },
    {
      icon: PiggyBank,
      label: "Toplam Kâr",
      value: formatKurus(kpis?.total_profit ?? 0),
      tone: profitTone(kpis?.total_profit),
      to: "/kasa",
    },
    {
      icon: ShieldCheck,
      label: "Bekleyen Garanti",
      value: String(kpis?.pending_warranty ?? 0),
      unit: "adet",
      to: "/garanti",
    },
    {
      icon: Award,
      label: "En Çok Satılan Marka",
      value: topBrand?.brand ?? "—",
      unit: topBrand ? `${topBrand.sold} adet` : undefined,
      to: "/satislar",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1680px] space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {cards.map((c, i) => (
            <DashboardCard
              key={c.label}
              icon={c.icon}
              label={c.label}
              value={c.value}
              unit={c.unit}
              tone={c.tone}
              index={i}
              onClick={() => navigate(c.to)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <QuickProfitCalculator />
          <RecentActivity />
        </div>

        <DashboardCharts />
      </div>
    </div>
  );
}
