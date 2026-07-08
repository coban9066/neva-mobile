const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const appDir = path.resolve(__dirname);
const lmDir = path.resolve(rootDir, "license-manager");
const releaseDir = path.resolve(rootDir, "release");
const updaterKeyDir = path.resolve(rootDir, "secrets", "updater");

const tauriConf = JSON.parse(
  fs.readFileSync(path.resolve(appDir, "src-tauri", "tauri.conf.json"), "utf8")
);
const APP_VERSION = tauriConf.version;
const PRODUCT_NAME = tauriConf.productName;
const UPDATER_ENDPOINT = tauriConf.plugins?.updater?.endpoints?.[0] ?? "";
// endpoint örneği: https://github.com/<owner>/<repo>/releases/latest/download/latest.json
const GITHUB_REPO_MATCH = UPDATER_ENDPOINT.match(/github\.com\/([^/]+)\/([^/]+)\//);
const GITHUB_REPO = GITHUB_REPO_MATCH ? `${GITHUB_REPO_MATCH[1]}/${GITHUB_REPO_MATCH[2]}` : null;

console.log("=== NEVA MOBILE RELEASE PIPELINE ===");

function runCmd(cmd, cwd, env) {
  console.log(`Running: ${cmd} in ${cwd}`);
  execSync(cmd, { cwd, stdio: "inherit", env: env ? { ...process.env, ...env } : process.env });
}

try {
  // 1. Clean previous release folder if exists
  if (fs.existsSync(releaseDir)) {
    console.log("Cleaning previous release directory...");
    fs.rmSync(releaseDir, { recursive: true, force: true });
  }

  // 2. Compile Main Application (Tauri release build) — updater artifact imzalama anahtarı gerekli.
  const updaterKeyPath = path.resolve(updaterKeyDir, "updater_private.key");
  const updaterPasswordPath = path.resolve(updaterKeyDir, "password.txt");
  if (!fs.existsSync(updaterKeyPath) || !fs.existsSync(updaterPasswordPath)) {
    throw new Error(
      `Updater imzalama anahtarı bulunamadı: ${updaterKeyPath}\n` +
      `tauri.conf.json içinde bir pubkey tanımlı olduğu için imzasız build başarısız olur.`
    );
  }
  console.log("\nBuilding NEVA MOBILE client application...");
  runCmd("npm run build", appDir);
  runCmd("npx tauri build", appDir, {
    TAURI_SIGNING_PRIVATE_KEY_PATH: updaterKeyPath,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: fs.readFileSync(updaterPasswordPath, "utf8").trim(),
  });

  // 3. Compile License Manager (Rust release build)
  console.log("\nBuilding NEVA LICENSE MANAGER developer utility...");
  runCmd("cargo build --release", lmDir);

  // 4. Run release binary once to generate private/public keys in target/release if not present
  console.log("\nEnsuring developer keys are generated in release...");
  const lmReleaseExe = path.resolve(lmDir, "target", "release", "neva-license-manager.exe");
  // Run with 'gen' arg to trigger headless run and generate key pair next to exe
  runCmd(`"${lmReleaseExe}" gen NVM-0000-0000-0000 7`, lmDir);

  // 5. Create release directory structure
  console.log("\nCreating release folders...");
  const musteriDir = path.resolve(releaseDir, "MUSTERI");
  const gelistiriciDir = path.resolve(releaseDir, "GELISTIRICI");
  fs.mkdirSync(musteriDir, { recursive: true });
  fs.mkdirSync(gelistiriciDir, { recursive: true });

  // 6. Copy customer binaries
  console.log("Copying NEVA MOBILE customer setup binaries...");
  const nsisDir = path.resolve(appDir, "src-tauri", "target", "release", "bundle", "nsis");
  const msiDir = path.resolve(appDir, "src-tauri", "target", "release", "bundle", "msi");
  const setupName = `${PRODUCT_NAME}_${APP_VERSION}_x64-setup.exe`;
  const msiName = `${PRODUCT_NAME}_${APP_VERSION}_x64_en-US.msi`;
  const setupSrc = path.resolve(nsisDir, setupName);
  const msiSrc = path.resolve(msiDir, msiName);
  fs.copyFileSync(setupSrc, path.resolve(musteriDir, "NEVA MOBILE Setup.exe"));
  fs.copyFileSync(msiSrc, path.resolve(musteriDir, "NEVA MOBILE.msi"));

  // 7. Copy developer binaries
  console.log("Copying NEVA LICENSE MANAGER developer binaries...");
  fs.copyFileSync(lmReleaseExe, path.resolve(gelistiriciDir, "NEVA LICENSE MANAGER.exe"));
  
  // Find private key. Since we ran it in target/release, it should be there.
  // If not, check target/debug or root.
  let privKeyPath = path.resolve(lmDir, "target", "release", "neva_private.key");
  if (!fs.existsSync(privKeyPath)) {
    privKeyPath = path.resolve(lmDir, "target", "debug", "neva_private.key");
  }
  if (fs.existsSync(privKeyPath)) {
    fs.copyFileSync(privKeyPath, path.resolve(gelistiriciDir, "neva_private.key"));
  } else {
    console.warn("WARNING: neva_private.key not found! GELISTIRICI will need to run the executable once to generate it.");
  }

  // 8. Create README files
  console.log("Writing README documentation...");
  const readmeMusteriContent = 
`=== NEVA MOBILE (Müşteri Kurulum Paketi) ===

1. "NEVA MOBILE Setup.exe" (veya "NEVA MOBILE.msi") dosyasını çift tıklayarak çalıştırın.
2. Kurulum bittikten sonra uygulamayı açın.
3. İlk açılışta karşınıza çıkacak olan "Cihaz Kimliğini" (Machine ID) kopyalayıp satıcınıza iletin.
4. Size verilecek olan Lisans Kodunu yapıştırarak uygulamayı kullanmaya başlayabilirsiniz.

* Uygulama tamamen çevrimdışı (offline) çalışır. İnternet bağlantısı veya ek kütüphane kurulumu gerektirmez.
`;
  fs.writeFileSync(path.resolve(musteriDir, "README.txt"), readmeMusteriContent, "utf8");

  const readmeGelistiriciContent =
`=== NEVA LICENSE MANAGER (Yalnızca Geliştirici İçindir - Müşteriye Göndermeyin!) ===

Bu klasör lisans kodları üretmek için gerekli araçları içerir:
- "NEVA LICENSE MANAGER.exe": Lisans kodu üretici programı.
- "neva_private.key": Lisansların dijital olarak imzalanmasını sağlayan Gizli Anahtar.

* DİKKAT: "neva_private.key" dosyasını kesinlikle müşterilerinizle veya başkalarıyla paylaşmayın.
`;
  fs.writeFileSync(path.resolve(gelistiriciDir, "README.txt"), readmeGelistiriciContent, "utf8");

  // 9. GitHub Release paketi: latest.json + imzalı updater artifact (auto-update kaynağı).
  console.log("\nPreparing GitHub Release assets (auto-update)...");
  const githubDir = path.resolve(releaseDir, "GITHUB");
  fs.mkdirSync(githubDir, { recursive: true });

  const nsisZipName = `${setupName}.nsis.zip`;
  const nsisZipSrc = path.resolve(nsisDir, nsisZipName);
  const nsisSigSrc = `${nsisZipSrc}.sig`;
  fs.copyFileSync(setupSrc, path.resolve(githubDir, setupName));
  fs.copyFileSync(nsisZipSrc, path.resolve(githubDir, nsisZipName));
  fs.copyFileSync(nsisSigSrc, path.resolve(githubDir, `${nsisZipName}.sig`));

  const notesPath = path.resolve(rootDir, "RELEASE_NOTES.md");
  const notes = fs.existsSync(notesPath)
    ? fs.readFileSync(notesPath, "utf8").trim()
    : `NEVA MOBILE ${APP_VERSION} yayınlandı.`;

  const tag = `v${APP_VERSION}`;
  const downloadBase = GITHUB_REPO
    ? `https://github.com/${GITHUB_REPO}/releases/download/${tag}`
    : "https://github.com/<OWNER>/<REPO>/releases/download/" + tag;

  const latestJson = {
    version: APP_VERSION,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: fs.readFileSync(path.resolve(githubDir, `${nsisZipName}.sig`), "utf8").trim(),
        url: `${downloadBase}/${encodeURIComponent(nsisZipName)}`,
      },
    },
  };
  fs.writeFileSync(
    path.resolve(githubDir, "latest.json"),
    JSON.stringify(latestJson, null, 2),
    "utf8"
  );

  if (!GITHUB_REPO) {
    console.warn(
      "\nWARNING: tauri.conf.json içindeki updater endpoint'i bir GitHub repo'suna işaret etmiyor. " +
      "latest.json içindeki indirme URL'leri <OWNER>/<REPO> placeholder'ı ile üretildi; " +
      "gerçek repo belli olunca hem tauri.conf.json hem bu build'i güncelleyin."
    );
  }

  const readmeGithubContent =
`=== NEVA MOBILE ${APP_VERSION} — GitHub Release Paketi (Auto-Update) ===

Bu klasördeki dosyalar, GitHub'da "${tag}" tag'iyle bir Release oluşturup
aynı isimlerle asset olarak yüklenmelidir:

- ${setupName}            (tam kurulum dosyası — yeni müşteriler için)
- ${nsisZipName}           (updater'ın indirdiği imzalı paket)
- ${nsisZipName}.sig       (imza dosyası — yalnızca referans, latest.json içine gömülü)
- latest.json              (uygulamanın güncelleme kontrolünde okuduğu manifest)

Adımlar:
1. GitHub reposunda "${tag}" tag'i ile yeni bir Release oluşturun.
2. Yukarıdaki 4 dosyayı Release asset'i olarak yükleyin (latest.json dahil).
3. Release'i yayınlayın (Publish release).

Uygulama, tauri.conf.json → plugins.updater.endpoints altındaki
"/releases/latest/download/latest.json" adresinden bu dosyayı okur;
GitHub bu adresi otomatik olarak en son yayınlanan Release'e yönlendirir.
`;
  fs.writeFileSync(path.resolve(githubDir, "README.txt"), readmeGithubContent, "utf8");

  console.log("\n=== RELEASE SUCCESSFUL ===");
  console.log(`Outputs available at: ${releaseDir}`);

} catch (err) {
  console.error("\n!!! RELEASE FAILED !!!");
  console.error(err);
  process.exit(1);
}
