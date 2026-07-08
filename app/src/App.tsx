import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Toaster } from "@/components/layout/Toaster";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickPurchase } from "@/components/QuickPurchase";
import { PhoneDrawer } from "@/components/PhoneDrawer";
import { Splash } from "@/components/Splash";
import { ActivationScreen } from "@/components/Activation";
import { UpdateDialog } from "@/components/UpdateDialog";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";
import { fetchLicenseStatus } from "@/lib/license";
import { useUi } from "@/stores/ui";
import { useUpdate } from "@/stores/update";
import { DashboardPage } from "@/pages/Dashboard";
import { PhonesPage } from "@/pages/Phones";
import { PurchasesPage } from "@/pages/Purchases";
import { SalesPage } from "@/pages/Sales";
import { WarrantyPage } from "@/pages/Warranty";
import { KasaPage } from "@/pages/Kasa";
import { SettingsPage } from "@/pages/Settings";
import { DataManagementPage } from "@/pages/DataManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

function ReadOnlyBanner() {
  const license = useUi((s) => s.license);
  if (license?.state !== "expired") return null;
  return (
    <div className="flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-xs">
      <ShieldAlert size={13} className="shrink-0 text-warning" />
      <span>
        <b>Lisans süresi doldu — salt okunur mod.</b> Verileriniz güvende; yeni işlem için
        Device ID'nizi gönderip lisansı yenileyin.
      </span>
    </div>
  );
}

function Workspace() {
  useGlobalHotkeys();
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <ReadOnlyBanner />
        <main className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/telefonlar" element={<PhonesPage />} />
            <Route path="/alislar" element={<PurchasesPage />} />
            <Route path="/satislar" element={<SalesPage />} />
            <Route path="/garanti" element={<WarrantyPage />} />
            <Route path="/kasa" element={<KasaPage />} />
            <Route path="/ayarlar" element={<SettingsPage />} />
            <Route path="/veri-yonetimi" element={<DataManagementPage />} />
          </Routes>
        </main>
        <StatusBar />
      </div>
      <CommandPalette />
      <QuickPurchase />
      <PhoneDrawer />
    </div>
  );
}

/** Lisans kapısı: durum yüklenene kadar splash; geçerli/expired dışı → aktivasyon. */
function LicenseGate() {
  const { license, setLicense, toast } = useUi();

  useEffect(() => {
    fetchLicenseStatus()
      .then(setLicense)
      .catch((e) => toast({ kind: "error", title: `Lisans kontrolü başarısız: ${String(e)}` }));
  }, [setLicense, toast]);

  const blocked =
    license && ["none", "invalid", "device_mismatch", "clock_rollback"].includes(license.state);

  return (
    <>
      {license && (blocked ? <ActivationScreen /> : <Workspace />)}
      <Toaster />
      <Splash />
    </>
  );
}

/** Açılışta sessizce güncelleme kontrolü yapar; internet yoksa/başarısızsa sessizce geçer. */
function AutoUpdateCheck() {
  const checkForUpdates = useUpdate((s) => s.checkForUpdates);

  useEffect(() => {
    checkForUpdates({ silent: true });
  }, [checkForUpdates]);

  return <UpdateDialog />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <LicenseGate />
        <AutoUpdateCheck />
      </HashRouter>
    </QueryClientProvider>
  );
}
