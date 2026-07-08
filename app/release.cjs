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

// GitHub asset adlarında boşluk dota çevrilir; updater URL'i öngörülebilir kalsın diye
// yüklenen dosyalar boşluksuz adlandırılır.
const SAFE_NAME = PRODUCT_NAME.replace(/\s+/g, "_");

console.log("=== NEVA MOBILE RELEASE PIPELINE ===");

function runCmd(cmd, cwd, env) {
  console.log(`Running: ${cmd} in ${cwd}`);
  execSync(cmd, { cwd, stdio: "inherit", env: env ? { ...process.env, ...env } : process.env });
}

// gh CLI: PATH'te yoksa standart kurulum yolunu dene (winget MSI mevcut oturumun PATH'ine yansımaz).
function ghExe() {
  const candidates = [
    "gh",
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "GitHub CLI", "gh.exe"),
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: "pipe" });
      return c;
    } catch {}
  }
  return null;
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

  // 9. Auto-update asset'leri MUSTERI klasörüne üretilir (GitHub Release'e yalnız buradan yüklenir).
  //    createUpdaterArtifacts formatına göre imza ya doğrudan setup.exe'nin (.sig) ya da
  //    v1-uyumlu .nsis.zip'in yanındadır; ikisi de desteklenir.
  console.log("\nPreparing auto-update assets (MUSTERI)...");
  const uploadSetupName = `${SAFE_NAME}_${APP_VERSION}_x64-setup.exe`;
  const exeSigSrc = `${setupSrc}.sig`;
  const nsisZipSrc = path.resolve(nsisDir, `${setupName}.nsis.zip`);
  const nsisZipSigSrc = `${nsisZipSrc}.sig`;

  let updaterAssetName;
  if (fs.existsSync(exeSigSrc)) {
    updaterAssetName = uploadSetupName;
    fs.copyFileSync(setupSrc, path.resolve(musteriDir, uploadSetupName));
    fs.copyFileSync(exeSigSrc, path.resolve(musteriDir, `${uploadSetupName}.sig`));
  } else if (fs.existsSync(nsisZipSigSrc)) {
    updaterAssetName = `${uploadSetupName}.nsis.zip`;
    fs.copyFileSync(setupSrc, path.resolve(musteriDir, uploadSetupName));
    fs.copyFileSync(nsisZipSrc, path.resolve(musteriDir, updaterAssetName));
    fs.copyFileSync(nsisZipSigSrc, path.resolve(musteriDir, `${updaterAssetName}.sig`));
  } else {
    throw new Error(
      "İmzalı updater artifact'i bulunamadı (.sig yok). " +
      "TAURI_SIGNING_PRIVATE_KEY(_PATH) ile build alındığından emin olun."
    );
  }

  const notesPath = path.resolve(rootDir, "RELEASE_NOTES.md");
  const notes = fs.existsSync(notesPath)
    ? fs.readFileSync(notesPath, "utf8").trim()
    : `NEVA MOBILE ${APP_VERSION} yayınlandı.`;

  const tag = `v${APP_VERSION}`;
  if (!GITHUB_REPO) {
    throw new Error("tauri.conf.json updater endpoint'i bir GitHub reposuna işaret etmiyor.");
  }
  const downloadBase = `https://github.com/${GITHUB_REPO}/releases/download/${tag}`;

  const latestJson = {
    version: APP_VERSION,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: fs
          .readFileSync(path.resolve(musteriDir, `${updaterAssetName}.sig`), "utf8")
          .trim(),
        url: `${downloadBase}/${updaterAssetName}`,
      },
    },
  };
  fs.writeFileSync(
    path.resolve(musteriDir, "latest.json"),
    JSON.stringify(latestJson, null, 2),
    "utf8"
  );

  // 10. GitHub Release yayını: YALNIZCA release/MUSTERI içindeki dosyalar asset olarak
  //     yüklenir. Kaynak kod, GELISTIRICI klasörü ve anahtarlar asla gönderilmez.
  if (process.env.SKIP_PUBLISH === "1") {
    console.log("\nSKIP_PUBLISH=1 — GitHub Release yayını atlandı.");
  } else {
    console.log(`\nPublishing GitHub Release ${tag} to ${GITHUB_REPO}...`);
    const gh = ghExe();
    if (!gh) {
      throw new Error(
        "GitHub CLI (gh) bulunamadı. Kurulum: winget install GitHub.cli, sonra: gh auth login"
      );
    }
    const assets = [
      path.resolve(musteriDir, updaterAssetName),
      path.resolve(musteriDir, `${updaterAssetName}.sig`),
      path.resolve(musteriDir, "latest.json"),
    ];
    for (const a of assets) {
      if (!fs.existsSync(a)) throw new Error(`Yüklenecek asset eksik: ${a}`);
    }
    const notesFile = path.resolve(releaseDir, "_notes.md");
    fs.writeFileSync(notesFile, notes, "utf8");
    const assetArgs = assets.map((a) => `"${a}"`).join(" ");

    let releaseExists = false;
    try {
      execSync(`"${gh}" release view ${tag} --repo ${GITHUB_REPO}`, { stdio: "pipe" });
      releaseExists = true;
    } catch {}

    if (releaseExists) {
      console.log(`Release ${tag} zaten var; asset'ler güncelleniyor (--clobber)...`);
      runCmd(`"${gh}" release upload ${tag} ${assetArgs} --clobber --repo ${GITHUB_REPO}`, appDir);
    } else {
      runCmd(
        `"${gh}" release create ${tag} ${assetArgs} --repo ${GITHUB_REPO} ` +
          `--title "NEVA MOBILE ${tag}" --notes-file "${notesFile}" --latest`,
        appDir
      );
    }
    fs.rmSync(notesFile, { force: true });
    console.log(`\nRelease URL: https://github.com/${GITHUB_REPO}/releases/tag/${tag}`);
  }

  console.log("\n=== RELEASE SUCCESSFUL ===");
  console.log(`Outputs available at: ${releaseDir}`);

} catch (err) {
  console.error("\n!!! RELEASE FAILED !!!");
  console.error(err);
  process.exit(1);
}
