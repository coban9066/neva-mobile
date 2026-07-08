import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdate } from "@/stores/update";

export function UpdateDialog() {
  const { info, dialogOpen, downloading, progress, closeDialog, installUpdate } = useUpdate();

  if (!info) return null;

  return (
    <Dialog
      open={dialogOpen}
      onClose={() => {
        if (!downloading) closeDialog();
      }}
      title="Yeni sürüm bulundu"
      width={480}
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={downloading} onClick={closeDialog}>
            Daha Sonra
          </Button>
          <Button variant="primary" size="sm" disabled={downloading} onClick={installUpdate}>
            {downloading
              ? progress != null
                ? `İndiriliyor… %${progress}`
                : "İndiriliyor…"
              : "Şimdi Güncelle"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        Yeni bir NEVA MOBILE sürümü yayınlandı. Güncelleme sırasında verileriniz
        (telefonlar, satışlar, kasa, lisans, ayarlar) korunur.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        <div>
          <dt className="text-[11px] uppercase text-fg-muted">Mevcut Sürüm</dt>
          <dd className="mt-0.5 font-medium">{info.currentVersion}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-fg-muted">Yeni Sürüm</dt>
          <dd className="mt-0.5 font-medium">{info.version}</dd>
        </div>
      </dl>

      {info.notes && (
        <div className="mt-3">
          <p className="text-[11px] uppercase text-fg-muted">Sürüm Notları</p>
          <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-bg p-2.5 font-sans text-xs text-fg-muted">
            {info.notes}
          </pre>
        </div>
      )}

      {downloading && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: progress != null ? `${progress}%` : "35%" }}
          />
        </div>
      )}
    </Dialog>
  );
}
