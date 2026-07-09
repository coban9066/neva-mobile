import { useState } from "react";
import {
  Database,
  AlertTriangle,
  ShieldAlert,
  HardDriveDownload,
  HardDriveUpload,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { useQueryClient } from "@tanstack/react-query";
import { useUi, isReadOnly } from "@/stores/ui";
import { exportBackup } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type PurgeKind = "sales" | "purchases";

export function DataManagementPage() {
  const { toast, license } = useUi();
  const qc = useQueryClient();

  const [loading, setLoading] = useState(false);

  // Purge configurations
  const [salesDays, setSalesDays] = useState<string>("all");
  const [purchasesDays, setPurchasesDays] = useState<string>("all");

  // Confirmation dialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<PurgeKind | null>(null);
  const [purgeDaysVal, setPurgeDaysVal] = useState<number | null>(null);

  // Geri yükleme onayı: seçilen .nevabackup dosyası
  const [restorePath, setRestorePath] = useState<string | null>(null);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const path = await exportBackup();
      if (path) toast({ kind: "success", title: `Yedek oluşturuldu: ${path}` });
    } catch (err) {
      toast({ kind: "error", title: `Yedekleme başarısız: ${String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  const handlePickRestore = async () => {
    const picked = await open({
      title: "Yedekten Geri Yükle",
      multiple: false,
      filters: [{ name: "NEVA MOBILE Yedek", extensions: ["nevabackup"] }],
    });
    if (typeof picked === "string") setRestorePath(picked);
  };

  const handleRestore = async () => {
    if (!restorePath) return;
    setLoading(true);
    try {
      await invoke("restore_database", { sourcePath: restorePath });
      toast({ kind: "success", title: "Yedek doğrulandı — uygulama yeniden başlatılıyor…" });
      // Dosya değişimi bir sonraki açılışta, DB bağlantısı kapalıyken yapılır.
      setTimeout(() => relaunch(), 800);
    } catch (err) {
      toast({ kind: "error", title: String(err) });
      setLoading(false);
    } finally {
      setRestorePath(null);
    }
  };

  const handleOpenConfirm = (kind: PurgeKind) => {
    if (isReadOnly(license)) {
      toast({ kind: "error", title: "Salt okunur modda bu işlem yapılamaz." });
      return;
    }

    const daysStr = kind === "sales" ? salesDays : purchasesDays;
    const daysNum = daysStr === "all" ? null : parseInt(daysStr, 10);

    setPurgeTarget(kind);
    setPurgeDaysVal(daysNum);
    setConfirmOpen(true);
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setLoading(true);
    setConfirmOpen(false);

    try {
      const deletedCount = await invoke<number>("purge_records", {
        kind: purgeTarget,
        olderThanDays: purgeDaysVal,
      });

      toast({
        kind: "success",
        title: `Veri temizleme başarılı.`,
        actions: [],
      });

      toast({
        kind: "info",
        title: `${deletedCount} adet ${
          purgeTarget === "sales" ? "satış" : "alış"
        } kaydı kalıcı olarak silindi.`,
      });

      // Invalidate all query caches to update lists, totals and dashboard KPIs
      await qc.invalidateQueries();
    } catch (err) {
      toast({ kind: "error", title: `Temizleme işlemi başarısız: ${String(err)}` });
    } finally {
      setLoading(false);
      setPurgeTarget(null);
      setPurgeDaysVal(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 bg-surface-2/10">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {/* Title Card */}
        <div className="rounded-lg border border-border bg-surface p-4 flex items-center gap-3">
          <Database className="text-primary" size={24} />
          <div>
            <h1 className="text-sm font-semibold">Veri Yönetimi</h1>
            <p className="text-xs text-fg-muted">
              Sistem performansını artırmak veya dükkan verilerini sıfırlamak için toplu temizlik işlemleri.
            </p>
          </div>
        </div>

        {/* Read Only Warning Banner */}
        {isReadOnly(license) && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs">
            <ShieldAlert size={16} className="shrink-0 text-warning" />
            <span>
              <b>Salt okunur mod aktif.</b> Lisansınız geçerli olmadığı için veri silme veya düzenleme işlemleri devre dışıdır.
            </span>
          </div>
        )}

        {/* Backup / Restore Section */}
        <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase text-fg-muted">Yedekleme</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Tüm veritabanı (telefonlar, satışlar, masraflar, cariler, ayarlar) tek bir{" "}
              <code className="font-mono">.nevabackup</code> dosyası olarak dışarı aktarılır.
              Geri yükleme, seçilen yedeği doğruladıktan sonra uygulamayı yeniden başlatır.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" onClick={handleBackup} disabled={loading} className="h-8 text-xs px-4">
              <HardDriveDownload size={14} /> Yedek Al
            </Button>
            <Button variant="outline" onClick={handlePickRestore} disabled={loading} className="h-8 text-xs px-4">
              <HardDriveUpload size={14} /> Yedekten Geri Yükle
            </Button>
          </div>
        </section>

        {/* Sales Purging Section */}
        <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase text-fg-muted">Satış Kayıtlarını Temizle</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Sistemdeki satış kayıtlarını, bunlara bağlı kasa hareketlerini, cari hesap ledger kayıtlarını ve garantileri kalıcı olarak siler. Satılan telefonlar sistemde kalır ancak satış geçmişleri silinir.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
            <div className="flex-1">
              <label htmlFor="sales-age-select" className="block text-[11px] uppercase text-fg-muted mb-1.5 font-medium">
                Tarih Kriteri
              </label>
              <select
                id="sales-age-select"
                value={salesDays}
                onChange={(e) => setSalesDays(e.target.value)}
                className="w-full h-8 rounded-md border border-border-strong bg-bg px-2.5 text-xs text-fg focus:border-primary focus:outline-none"
              >
                <option value="all">Tüm Satış Kayıtlarını Sil (Sıfırla)</option>
                <option value="30">30 Günden Eski Kayıtları Sil</option>
                <option value="90">90 Günden Eski Kayıtları Sil</option>
                <option value="180">180 Günden Eski Kayıtları Sil</option>
              </select>
            </div>

            <Button
              variant="destructive"
              onClick={() => handleOpenConfirm("sales")}
              disabled={loading || isReadOnly(license)}
              className="h-8 text-xs px-4"
            >
              Satışları Temizle
            </Button>
          </div>
        </section>

        {/* Purchases Purging Section */}
        <section className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase text-fg-muted">Alış Kayıtlarını Temizle</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Sistemdeki alış kayıtlarını kalıcı olarak siler. <b>Dikkat:</b> Sadece henüz satışı yapılmamış (stokta, rezerve, konsinye vb.) olan alış kayıtları silinir. Satışa bağlanmış olan alışlar atlanır.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
            <div className="flex-1">
              <label htmlFor="purchases-age-select" className="block text-[11px] uppercase text-fg-muted mb-1.5 font-medium">
                Tarih Kriteri
              </label>
              <select
                id="purchases-age-select"
                value={purchasesDays}
                onChange={(e) => setPurchasesDays(e.target.value)}
                className="w-full h-8 rounded-md border border-border-strong bg-bg px-2.5 text-xs text-fg focus:border-primary focus:outline-none"
              >
                <option value="all">Tüm Satışı Olmayan Alışları Sil</option>
                <option value="30">30 Günden Eski Satışı Olmayan Alışları Sil</option>
                <option value="90">90 Günden Eski Satışı Olmayan Alışları Sil</option>
                <option value="180">180 Günden Eski Satışı Olmayan Alışları Sil</option>
              </select>
            </div>

            <Button
              variant="destructive"
              onClick={() => handleOpenConfirm("purchases")}
              disabled={loading || isReadOnly(license)}
              className="h-8 text-xs px-4"
            >
              Alışları Temizle
            </Button>
          </div>
        </section>

        {/* System Warnings */}
        <div className="rounded-lg border border-border bg-surface p-4 flex items-start gap-3">
          <AlertTriangle className="text-warning shrink-0 mt-0.5" size={16} />
          <div className="text-xs space-y-1 text-fg-muted">
            <p className="font-semibold text-fg">Güvenlik ve Yedekleme Tavsiyesi</p>
            <p>
              Temizleme işlemleri doğrudan SQLite veritabanı üzerinde çalışır ve verileri fiziksel olarak temizler. Herhangi bir temizleme işlemi yapmadan önce yedek almanızı öneririz.
            </p>
          </div>
        </div>
      </div>

      {/* RESTORE CONFIRMATION DIALOG */}
      <Dialog
        open={restorePath !== null}
        onClose={() => setRestorePath(null)}
        title="Yedekten Geri Yükleme Onayı"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestorePath(null)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleRestore} className="min-w-[100px]">
              Geri Yükle ve Yeniden Başlat
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-fg leading-relaxed">
            Seçilen yedek: <code className="font-mono text-[11px]">{restorePath}</code>
          </p>
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs space-y-1 text-destructive">
            <p className="font-semibold">UYARI:</p>
            <p>
              Mevcut veritabanının yerini bu yedek alacaktır. Yedek alındıktan SONRA girilen tüm
              kayıtlar kaybolur. Devam etmeden önce güncel verinin de yedeğini almanız önerilir.
            </p>
          </div>
        </div>
      </Dialog>

      {/* CONFIRMATION DIALOG */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Veri Silme Onayı"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handlePurge} className="min-w-[100px]">
              Kalıcı Olarak Sil
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-fg leading-relaxed">
            Seçtiğiniz <b>{purgeTarget === "sales" ? "Satış" : "Alış"}</b> kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz?
          </p>
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs space-y-1 text-destructive">
            <p className="font-semibold">UYARI:</p>
            <p>
              {purgeDaysVal === null
                ? "Sistemdeki tüm kayıtlar silinecektir."
                : `Son ${purgeDaysVal} gün dışındaki tüm kayıtlar silinecektir.`}
            </p>
            <p>Bu işlem geri alınamaz ve tüm ilişkili kasa, cari ve fatura hareketlerini silecektir.</p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
