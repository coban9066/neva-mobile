import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { select, selectOne, execute } from "@/lib/db";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { formatDateTime, cn } from "@/lib/utils";
import { useUi, isReadOnly } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Field } from "@/components/ui/input";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";

interface TillRow {
  id: number;
  date: string;
  direction: "in" | "out";
  method: "cash" | "pos" | "transfer" | "other";
  amount: number;
  note: string | null;
  ref_type: string | null;
  ref_id: number | null;
  phone_label: string | null;
  imei: string | null;
  // Calculated dynamically
  balance: number;
}

const CATEGORIES = ["Kargo", "Elektrik", "Kira", "Aksesuar Satışı", "Diğer"] as const;

export function KasaPage() {
  const { toast, license } = useUi();
  const qc = useQueryClient();

  // --- Search & Filters ---
  const [filterType, setFilterType] = useState<"today" | "week" | "month" | "all">("today");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Manual Transaction Dialog ---
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDirection, setManualDirection] = useState<"in" | "out">("in");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("Diğer");
  const [description, setDescription] = useState("");
  const [priceRaw, setPriceRaw] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pos" | "transfer">("cash");
  const [saving, setSaving] = useState(false);

  // Fetch all till entries chronologically to compute correct historical running balances
  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: ["till-entries-raw"],
    queryFn: () =>
      select<Omit<TillRow, "balance">>(
        `SELECT t.id, t.date, t.direction, t.method, t.amount, t.note, t.ref_type, t.ref_id,
               CASE 
                 WHEN t.ref_type = 'sale' THEN (
                   SELECT COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id)
                   FROM sales s
                   JOIN phones p ON p.id = s.phone_id
                   LEFT JOIN brands b ON b.id = p.brand_id
                   WHERE s.id = t.ref_id
                 )
                 WHEN t.ref_type = 'acquisition' THEN (
                   SELECT COALESCE(b.name || ' ' || p.model, 'Telefon #' || p.id)
                   FROM acquisitions a
                   JOIN phones p ON p.id = a.phone_id
                   LEFT JOIN brands b ON b.id = p.brand_id
                   WHERE a.id = t.ref_id
                 )
                 ELSE NULL
               END AS phone_label,
               CASE 
                 WHEN t.ref_type = 'sale' THEN (
                   SELECT p.imei1
                   FROM sales s
                   JOIN phones p ON p.id = s.phone_id
                   WHERE s.id = t.ref_id
                 )
                 WHEN t.ref_type = 'acquisition' THEN (
                   SELECT p.imei1
                   FROM acquisitions a
                   JOIN phones p ON p.id = a.phone_id
                   WHERE a.id = t.ref_id
                 )
                 ELSE NULL
               END AS imei
        FROM till_entries t
        ORDER BY t.date ASC, t.id ASC`
      ),
  });

  const getLocalDateString = (d: Date = new Date()) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Compute Running Balances and KPIs
  const { processedRows, kpis } = useMemo(() => {
    let runningBalance = 0;
    let cashBalance = 0;
    let todayIncome = 0;
    let todayExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    const todayStr = getLocalDateString(new Date());
    const monthStr = todayStr.slice(0, 7); // YYYY-MM

    const processed = rawRows.map((r) => {
      const isIncome = r.direction === "in";
      const change = isIncome ? r.amount : -r.amount;
      runningBalance += change;

      // Kasadaki Nakit (only method = 'cash')
      if (r.method === "cash") {
        cashBalance += change;
      }

      const txDate = r.date.slice(0, 10);
      const txMonth = r.date.slice(0, 7);

      // Today's Tahsilat / Ödeme
      if (txDate === todayStr) {
        if (isIncome) todayIncome += r.amount;
        else todayExpense += r.amount;
      }

      // This Month's Tahsilat / Ödeme
      if (txMonth === monthStr) {
        if (isIncome) monthIncome += r.amount;
        else monthExpense += r.amount;
      }

      return {
        ...r,
        balance: runningBalance,
      } as TillRow;
    });

    return {
      processedRows: processed,
      kpis: {
        cashBalance,
        todayIncome,
        todayExpense,
        monthIncome,
        monthExpense,
      },
    };
  }, [rawRows]);

  // Apply Search and Date Filters in JS for maximum responsiveness
  const filteredRows = useMemo(() => {
    const todayStr = getLocalDateString(new Date());

    // Monday of current week calculation
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const mondayStr = getLocalDateString(monday);

    const monthStr = todayStr.slice(0, 7);

    let list = processedRows;

    // 1. Apply Date Filter
    if (filterType === "today") {
      list = list.filter((r) => r.date.slice(0, 10) === todayStr);
    } else if (filterType === "week") {
      list = list.filter((r) => r.date.slice(0, 10) >= mondayStr);
    } else if (filterType === "month") {
      list = list.filter((r) => r.date.slice(0, 7) === monthStr);
    }

    // 2. Apply Search (Phone, IMEI, Description/Note)
    const cleanSearch = searchQuery.trim().toLowerCase();
    if (cleanSearch) {
      list = list.filter((r) => {
        const phoneMatch = r.phone_label?.toLowerCase().includes(cleanSearch);
        const imeiMatch = r.imei?.toLowerCase().includes(cleanSearch);
        const noteMatch = r.note?.toLowerCase().includes(cleanSearch);
        return phoneMatch || imeiMatch || noteMatch;
      });
    }

    // Return reversed so latest is shown first in the UI
    return [...list].reverse();
  }, [processedRows, filterType, searchQuery]);

  // Slice DOM elements to render maximum of 500 rows for 60fps performance
  const displayRows = useMemo(() => filteredRows.slice(0, 500), [filteredRows]);

  const handleOpenManual = (dir: "in" | "out") => {
    if (isReadOnly(license)) {
      toast({ kind: "error", title: "Salt okunur modda manuel kasa hareketi eklenemez." });
      return;
    }
    setManualDirection(dir);
    setCategory("Diğer");
    setDescription("");
    setPriceRaw("");
    setPaymentMethod("cash");
    setManualOpen(true);
  };

  const handleSaveManual = async () => {
    const amount = parseLiraInput(priceRaw);
    if (!amount || amount <= 0) {
      toast({ kind: "error", title: "Lütfen geçerli bir tutar girin." });
      return;
    }

    const cleanDesc = description.trim();
    const finalNote = `[${category}]${cleanDesc ? " " + cleanDesc : ""}`;

    setSaving(true);
    try {
      await execute(
        `INSERT INTO till_entries (direction, method, amount, ref_type, note)
         VALUES ($1, $2, $3, 'manual', $4)`,
        [manualDirection, paymentMethod, amount, finalNote]
      );

      toast({
        kind: "success",
        title: `${manualDirection === "in" ? "Gelir" : "Gider"} kaydı başarıyla eklendi.`,
      });

      // Refetch till entries
      await qc.invalidateQueries({ queryKey: ["till-entries-raw"] });
      // Dashboard KPIs also read from till entries
      await qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });

      setManualOpen(false);
    } catch (err) {
      toast({ kind: "error", title: `Kayıt eklenemedi: ${String(err)}` });
    } finally {
      setSaving(false);
    }
  };

  const getMethodLabel = (m: string) => {
    if (m === "cash") return "Nakit";
    if (m === "pos") return "POS";
    if (m === "transfer") return "Havale";
    return "Diğer";
  };

  // --- Export to Excel (CSV) ---
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      toast({ kind: "info", title: "Aktarılacak veri bulunamadı." });
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Tarih;İşlem;Ödeme Türü;Tutar;Açıklama;Telefon;IMEI;Bakiye\n";

    filteredRows.forEach((r) => {
      const date = formatDateTime(r.date);
      const direction = r.direction === "in" ? "Gelir" : "Gider";
      const method = getMethodLabel(r.method);
      const amountStr = (r.direction === "in" ? "" : "-") + (r.amount / 100).toFixed(2);
      const note = (r.note ?? "").replace(/;/g, ",");
      const phone = (r.phone_label ?? "").replace(/;/g, ",");
      const imei = r.imei ?? "";
      const balanceStr = (r.balance / 100).toFixed(2);

      csvContent += `${date};${direction};${method};${amountStr};${note};${phone};${imei};${balanceStr}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Name file according to selected filter
    const filterLabels = { today: "Gun_Sonu_Raporu", week: "Haftalik_Kasa_Raporu", month: "Ay_Sonu_Raporu", all: "Kasa_Defteri" };
    link.setAttribute("download", `${filterLabels[filterType]}_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Export to PDF (Print friendly view) ---
  const handlePrintPDF = () => {
    window.print();
  };

  // --- Gün Sonu PDF Raporu ---
  const handleDailyReportPdf = async () => {
    try {
      const today = getLocalDateString(new Date());
      const row = await selectOne<{
        daily_revenue: number | null;
        daily_profit: number | null;
        pos_commission: number | null;
        total_expenses: number | null;
        sales_count: number;
        total_stock: number;
      }>(
        `SELECT
          (SELECT SUM(price) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS daily_revenue,
          (SELECT SUM(net_profit) FROM v_phone_profit WHERE date(sale_date)=date('now','localtime')) AS daily_profit,
          (SELECT SUM(commission_amount) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL AND payment_method='pos') AS pos_commission,
          (SELECT SUM(amount) FROM expenses WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS total_expenses,
          (SELECT COUNT(*) FROM sales WHERE date(date)=date('now','localtime') AND deleted_at IS NULL) AS sales_count,
          (SELECT phone_count FROM v_stock_value) AS total_stock`
      );

      const saved = await generateDailyReportPdf({
        date: today,
        dailyRevenue: row?.daily_revenue ?? 0,
        dailyProfit: row?.daily_profit ?? 0,
        posCommission: row?.pos_commission ?? 0,
        totalExpenses: row?.total_expenses ?? 0,
        salesCount: row?.sales_count ?? 0,
        totalStock: row?.total_stock ?? 0,
      });

      if (saved) {
        toast({ kind: "success", title: "Gün sonu raporu PDF olarak oluşturuldu." });
      }
    } catch (err) {
      toast({ kind: "error", title: `Rapor oluşturulamadı: ${String(err)}` });
    }
  };

  const activeFilterLabel = {
    today: "Gün Sonu Raporu (Bugün)",
    week: "Haftalık Kasa Raporu (Bu Hafta)",
    month: "Ay Sonu Raporu (Bu Ay)",
    all: "Tüm Kasa Raporu (Kasa Defteri)",
  }[filterType];

  return (
    <div className="flex h-full flex-col bg-surface-2/10">
      {/* SCREEN HEADER */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Kasa</h1>
          <span className="text-xs text-fg-muted">Günlük para akış takibi ve raporlama</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenManual("in")}
            disabled={isReadOnly(license)}
            className="h-7 text-xs px-2.5 border-success/30 hover:bg-success/5 hover:text-success text-success-strong"
          >
            <Plus size={14} className="mr-1" /> Gelir Ekle
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOpenManual("out")}
            disabled={isReadOnly(license)}
            className="h-7 text-xs px-2.5 border-destructive/30 hover:bg-destructive/5 hover:text-destructive text-destructive-strong"
          >
            <Minus size={14} className="mr-1" /> Gider Ekle
          </Button>
        </div>
      </div>

      {/* UPPER KPI BLOCKS */}
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5 print:hidden">
        {/* Kasadaki Nakit */}
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Kasadaki Nakit</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="tabular font-mono text-lg font-bold text-fg">
              {formatKurus(kpis.cashBalance)}
            </span>
            <Wallet size={16} className="text-fg-muted shrink-0" />
          </div>
        </div>

        {/* Bugünkü Tahsilat */}
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Bugünkü Tahsilat</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="tabular font-mono text-lg font-bold text-success">
              {formatKurus(kpis.todayIncome)}
            </span>
            <TrendingUp size={16} className="text-success shrink-0" />
          </div>
        </div>

        {/* Bugünkü Ödeme */}
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Bugünkü Ödeme</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="tabular font-mono text-lg font-bold text-destructive">
              {formatKurus(kpis.todayExpense)}
            </span>
            <TrendingDown size={16} className="text-destructive shrink-0" />
          </div>
        </div>

        {/* Bu Ayki Tahsilat */}
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Bu Ay Tahsilat</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="tabular font-mono text-lg font-semibold text-success">
              {formatKurus(kpis.monthIncome)}
            </span>
            <TrendingUp size={16} className="text-success/60 shrink-0" />
          </div>
        </div>

        {/* Bu Ayki Ödeme */}
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Bu Ay Ödeme</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="tabular font-mono text-lg font-semibold text-destructive">
              {formatKurus(kpis.monthExpense)}
            </span>
            <TrendingDown size={16} className="text-destructive/60 shrink-0" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="border-b border-border bg-surface px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        {/* Date Filter Tabs */}
        <div className="flex gap-1 bg-surface-2/60 p-0.5 rounded-lg border border-border">
          {(
            [
              ["today", "Bugün"],
              ["week", "Bu Hafta"],
              ["month", "Bu Ay"],
              ["all", "Tümü"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filterType === key
                  ? "bg-surface text-fg shadow-sm font-semibold"
                  : "text-fg-muted hover:text-fg"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input and Export Actions */}
        <div className="flex items-center gap-2">
          <div className="relative w-60">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Telefon, IMEI veya açıklama ara…"
              className="h-7 pl-7 text-xs"
            />
          </div>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            title="Excel (CSV) olarak aktar"
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <FileSpreadsheet size={13} />
            Excel
          </Button>

          <Button
            variant="outline"
            onClick={handlePrintPDF}
            title="Rapor olarak yazdır / PDF kaydet"
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <Printer size={13} />
            Yazdır
          </Button>

          <Button
            variant="outline"
            onClick={handleDailyReportPdf}
            title="Gün Sonu Raporu (PDF)"
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <FileText size={13} />
            Gün Sonu PDF
          </Button>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block p-6 border-b border-border space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-wide">NEVA MOBILE</h1>
            <p className="text-sm font-medium text-fg-muted">{activeFilterLabel}</p>
          </div>
          <div className="text-right text-xs text-fg-muted">
            <p>Rapor Tarihi: {formatDateTime(new Date().toISOString())}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 pt-4 text-xs">
          <div className="border border-border p-2 rounded">
            <p className="text-fg-muted uppercase font-semibold text-[9px]">Kasadaki Nakit (Nakit)</p>
            <p className="font-mono text-sm font-bold mt-0.5">{formatKurus(kpis.cashBalance)}</p>
          </div>
          <div className="border border-border p-2 rounded">
            <p className="text-fg-muted uppercase font-semibold text-[9px]">Toplam Tahsilat (Bu Dönem)</p>
            <p className="font-mono text-sm font-bold text-success mt-0.5">
              {formatKurus(
                filteredRows.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0)
              )}
            </p>
          </div>
          <div className="border border-border p-2 rounded">
            <p className="text-fg-muted uppercase font-semibold text-[9px]">Toplam Ödeme (Bu Dönem)</p>
            <p className="font-mono text-sm font-bold text-destructive mt-0.5">
              {formatKurus(
                filteredRows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0)
              )}
            </p>
          </div>
          <div className="border border-border p-2 rounded">
            <p className="text-fg-muted uppercase font-semibold text-[9px]">Toplam Hareket Sayısı</p>
            <p className="font-mono text-sm font-bold mt-0.5">{filteredRows.length} adet</p>
          </div>
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      <div className="flex-1 overflow-y-auto min-h-0 print:overflow-visible">
        {isLoading ? (
          <div className="space-y-2 p-4 print:hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-fg-muted print:hidden">
            <Wallet size={36} className="opacity-40 mb-3" />
            <p className="text-sm font-medium">Kasa hareketi bulunamadı.</p>
            <p className="text-xs text-fg-muted mt-1">Filtre kriterlerini değiştirebilir veya manuel hareket ekleyebilirsiniz.</p>
          </div>
        ) : (
          <table className="w-full text-[13px] print:text-xs">
            <thead className="sticky top-0 bg-surface print:static">
              <tr className="border-b border-border text-left text-[11px] uppercase text-fg-muted font-semibold">
                <th className="px-4 py-2 font-medium">Tarih</th>
                <th className="px-2 py-2 font-medium">İşlem</th>
                <th className="px-2 py-2 font-medium">Telefon</th>
                <th className="px-2 py-2 font-medium">Açıklama</th>
                <th className="px-2 py-2 font-medium">Ödeme Türü</th>
                <th className="px-2 py-2 text-right font-medium">Tutar</th>
                <th className="px-4 py-2 text-right font-medium">Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {displayRows.map((r) => {
                const isIncome = r.direction === "in";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/40 hover:bg-surface-2/40 transition-colors print:hover:bg-transparent"
                  >
                    <td className="px-4 py-2 text-fg-muted whitespace-nowrap">
                      {formatDateTime(r.date)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          isIncome
                            ? "bg-success/8 text-success-strong"
                            : "bg-destructive/8 text-destructive-strong"
                        )}
                      >
                        {isIncome ? "Gelir" : "Gider"}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-medium">
                      {r.phone_label ? (
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.phone_label}</p>
                          {r.imei && <p className="font-mono text-[10px] text-fg-muted">{r.imei}</p>}
                        </div>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 break-words max-w-xs">{r.note ?? "—"}</td>
                    <td className="px-2 py-2 text-fg-muted whitespace-nowrap">
                      {getMethodLabel(r.method)}
                    </td>
                    <td
                      className={cn(
                        "tabular px-2 py-2 text-right font-semibold whitespace-nowrap",
                        isIncome ? "text-success" : "text-destructive"
                      )}
                    >
                      {isIncome ? "+" : "-"}
                      {formatKurus(r.amount)}
                    </td>
                    <td className="tabular px-4 py-2 text-right font-medium text-fg-muted font-mono whitespace-nowrap">
                      {formatKurus(r.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {filteredRows.length > 500 && (
          <div className="py-4 text-center text-xs text-fg-muted border-t border-border bg-surface/50 print:hidden">
            Performans için en son 500 hareket gösteriliyor. Tüm hareketler Excel/Yazıcı raporunda mevcuttur.
          </div>
        )}
      </div>

      {/* PRINT-ONLY FOOTER */}
      <div className="hidden print:block p-4 text-center text-[10px] text-fg-muted border-t border-border mt-8">
        NEVA MOBILE · Telefon Alım Satım Yönetim Sistemi · Sayfa 1 / 1
      </div>

      {/* ADD MANUAL ENTRY DIALOG */}
      <Dialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={manualDirection === "in" ? "Kasa Geliri Ekle" : "Kasa Gideri Ekle"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManualOpen(false)} disabled={saving}>
              İptal
            </Button>
            <Button
              variant={manualDirection === "in" ? "primary" : "destructive"}
              onClick={handleSaveManual}
              disabled={saving}
              className="min-w-[80px]"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Category Picker */}
          <Field label="Kategori">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={cn(
                    "h-8 cursor-pointer rounded-md border text-[11px] font-medium transition-colors duration-200",
                    category === cat
                      ? "border-primary bg-primary text-on-primary shadow-sm"
                      : "border-border-strong bg-surface text-fg-muted hover:border-primary/50 hover:text-fg"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Field>

          {/* Description */}
          <Field label="Açıklama (Not)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Örnek: Temmuz ayı dükkan kirası"
            />
          </Field>

          {/* Amount */}
          <Field label="Tutar (₺)">
            <Input
              value={priceRaw}
              onChange={(e) => setPriceRaw(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="1.500"
              inputMode="decimal"
              className="tabular font-mono"
            />
          </Field>

          {/* Payment Method */}
          <Field label="Ödeme Türü">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["cash", "Nakit"],
                  ["pos", "POS"],
                  ["transfer", "Havale"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  aria-pressed={paymentMethod === key}
                  className={cn(
                    "h-8 cursor-pointer rounded-md border text-xs font-medium transition-colors duration-200",
                    paymentMethod === key
                      ? "border-primary bg-primary text-on-primary shadow-sm"
                      : "border-border-strong bg-surface text-fg-muted hover:border-primary/50 hover:text-fg"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
