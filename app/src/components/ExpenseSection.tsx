import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Check, X, Receipt } from "lucide-react";
import { select, execute } from "@/lib/db";
import { formatKurus, parseLiraInput } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { useUi, isReadOnly } from "@/stores/ui";
import { Input } from "@/components/ui/input";
import type { Expense } from "@/types";

/**
 * Masraf CRUD: her alış turuna ("acquisition") bağlı, tamamen serbest metin
 * başlık + tutar. v_phone_cost bu tabloyu otomatik topladığı için Toplam
 * Maliyet/Kar Hesabı başka bir değişiklik gerektirmeden kendiliğinden güncellenir.
 */
export function ExpenseSection({
  acquisitionId,
  phoneId,
}: {
  acquisitionId: number;
  phoneId: number;
}) {
  const qc = useQueryClient();
  const { license, toast } = useUi();
  const readOnly = isReadOnly(license);

  const { data: expenses = [] } = useQuery({
    queryKey: ["phone-expenses", acquisitionId],
    queryFn: () =>
      select<Expense>(
        `SELECT id, acquisition_id, category, amount, date FROM expenses
         WHERE acquisition_id = $1 AND deleted_at IS NULL ORDER BY date DESC`,
        [acquisitionId]
      ),
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const formOpen = adding || editingId != null;

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setLabel("");
    setAmountRaw("");
  }
  function startEdit(e: Expense) {
    setEditingId(e.id);
    setAdding(false);
    setLabel(e.category);
    setAmountRaw(String(e.amount / 100));
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["phone-expenses", acquisitionId] }),
      qc.invalidateQueries({ queryKey: ["phone-detail", phoneId] }),
      qc.invalidateQueries({ queryKey: ["phones"] }),
      qc.invalidateQueries({ queryKey: ["phone-timeline", phoneId] }),
      qc.invalidateQueries({ queryKey: ["sale-stock"] }),
    ]);
  }

  async function save() {
    const amount = parseLiraInput(amountRaw);
    if (!label.trim() || amount === null || amount <= 0 || saving) return;
    setSaving(true);
    try {
      if (editingId != null) {
        await execute("UPDATE expenses SET category = $1, amount = $2 WHERE id = $3", [
          label.trim(),
          amount,
          editingId,
        ]);
      } else {
        await execute(
          "INSERT INTO expenses (phone_id, acquisition_id, category, amount) VALUES ($1,$2,$3,$4)",
          [phoneId, acquisitionId, label.trim(), amount]
        );
      }
      await invalidateAll();
      toast({ kind: "success", title: editingId != null ? "Masraf güncellendi." : "Masraf eklendi." });
      cancel();
    } catch (e) {
      toast({ kind: "error", title: `Kaydedilemedi: ${String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await execute("UPDATE expenses SET deleted_at = datetime('now','localtime') WHERE id = $1", [id]);
      await invalidateAll();
      toast({ kind: "success", title: "Masraf silindi." });
    } catch (e) {
      toast({ kind: "error", title: `Silinemedi: ${String(e)}` });
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-2/40 p-3">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Receipt size={13} className="text-destructive" strokeWidth={1.75} />
          Masraflar
        </h3>
        {!readOnly && !formOpen && (
          <button
            onClick={startAdd}
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Plus size={11} /> Masraf Ekle
          </button>
        )}
      </header>

      <div className="mt-2 space-y-1.5">
        {expenses.length === 0 && !formOpen && (
          <p className="text-[11px] text-fg-muted">Bu turda henüz masraf yok.</p>
        )}

        {expenses.map((e) =>
          editingId === e.id ? (
            <div key={e.id} className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={label}
                onChange={(ev) => setLabel(ev.target.value)}
                placeholder="Kargo"
                className="h-7 text-xs"
              />
              <Input
                value={amountRaw}
                onChange={(ev) => setAmountRaw(ev.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="500"
                inputMode="decimal"
                className="h-7 w-24 tabular text-xs"
              />
              <button
                onClick={save}
                disabled={saving || !label.trim() || !amountRaw}
                className="cursor-pointer rounded p-1 text-success hover:bg-success/10 disabled:opacity-40"
              >
                <Check size={13} />
              </button>
              <button onClick={cancel} className="cursor-pointer rounded p-1 text-fg-muted hover:bg-surface-2">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-md px-1.5 py-1 text-[12px] hover:bg-surface-2/60"
            >
              <div className="min-w-0 truncate">
                <span className="font-medium">{e.category}</span>
                <span className="ml-1.5 text-[10px] text-fg-muted">{formatDate(e.date)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabular font-mono font-medium">{formatKurus(e.amount)}</span>
                {!readOnly && (
                  <>
                    <button
                      onClick={() => startEdit(e)}
                      title="Düzenle"
                      className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-fg"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => remove(e.id)}
                      title="Sil"
                      className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-destructive"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {adding && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Kargo, Bakım, Ekran…"
              className="h-7 text-xs"
            />
            <Input
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="500"
              inputMode="decimal"
              className="h-7 w-24 tabular text-xs"
            />
            <button
              onClick={save}
              disabled={saving || !label.trim() || !amountRaw}
              className="cursor-pointer rounded p-1 text-success hover:bg-success/10 disabled:opacity-40"
            >
              <Check size={13} />
            </button>
            <button onClick={cancel} className="cursor-pointer rounded p-1 text-fg-muted hover:bg-surface-2">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12px]">
          <span className="font-medium text-fg-muted">Toplam Masraf</span>
          <span className="tabular font-mono font-semibold">{formatKurus(total)}</span>
        </div>
      )}
    </section>
  );
}
