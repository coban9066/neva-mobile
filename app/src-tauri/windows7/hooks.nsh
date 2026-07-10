; NEVA MOBILE - Windows 7 Legacy Edition NSIS kancalari
; SADECE windows7-legacy branch'inde bulunur.
;
; Neden: Guncel MicrosoftEdgeWebView2Setup.exe bootstrapper'i Windows 7'de calismaz
; (GetPackagesByPackageFamily / KERNEL32.dll hatasi). Bu yuzden webviewInstallMode=skip
; ile bootstrapper devre disi birakildi; WebView2 kontrolu burada elle yapiliyor.
;
; Windows 7'de calisan son WebView2 Runtime: 109.0.1518.140 (Edge 109, Win7/8/8.1
; destegini kaldirmadan onceki son surum). "WebView2Runtime109-x64.exe" olarak
; paketlenen dosya gercekte Microsoft Edge 109 tam offline yukleyicisidir
; (VersionInfo: FileDescription="Microsoft Edge Installer", ProductVersion
; 109.0.1518.140) - Edge kurulumu ayni zamanda WebView2 Runtime istemcisini de
; (EdgeUpdate Clients GUID {F3017226-...}) kayit defterine yazar; asagidaki
; kontrol dogrudan bu anahtari arar.
;
; v0.2.0 DUZELTMESI: Onceki surumde ExecWait sonucu HIC KONTROL EDILMIYORDU -
; yukleyici (yanlis/gecersiz parametrelerle) sessizce basarisiz olsa bile
; kurulum "basarili" varsayilip devam ediyordu; kullanici uygulamayi actiginda
; "Could not find the WebView2 Runtime" hatasiyla karsilasiyordu. Simdi:
;   1) Kurulumdan SONRA kayit defteri TEKRAR okunuyor (exit code'a korlemesine
;      guvenilmiyor - bazi ortamlarda 0 donup gercek kurulum olmayabiliyor).
;   2) Hala bulunamazsa kullaniciya acik, dogru bir sonraki adim gosteriliyor.
;   3) Kullanilan parametreler Chromium tabanli yukleyicilerin belgelenen
;      standart sessiz kurulum anahtarlarina (--silent, --system-level)
;      indirgendi; onceki --msedgewebview / --do-not-launch-msedge anahtarlari
;      dogrulanmamisti ve olasi "gecersiz parametre" hatasinin kaynagi olabilirdi.

!macro NSIS_HOOK_PREINSTALL
  ; Makine seviyesi WebView2 kontrolu
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 webview2_ok
  ; Kullanici seviyesi WebView2 kontrolu
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 webview2_ok

  ; WebView2 yok - yaninda tasidigimiz 109 yukleyicisi var mi?
  IfFileExists "$EXEDIR\WebView2Runtime109-x64.exe" 0 install_failed
    DetailPrint "WebView2 Runtime 109 kuruluyor (Windows 7 uyumlu son surum)..."
    ExecWait '"$EXEDIR\WebView2Runtime109-x64.exe" --silent --system-level' $1
    DetailPrint "Yukleyici sonlandi (exit code: $1) - dogrulama yapiliyor..."

    ; Exit code'a korlemesine guvenme - kurulumun GERCEKTEN calistigini
    ; kayit defterinden tekrar dogrula.
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    StrCmp $0 "" 0 webview2_ok
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    StrCmp $0 "" 0 webview2_ok
    Goto install_failed

  install_failed:
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "WebView2 Runtime kurulamadi.$\r$\n$\r$\nNEVA MOBILE'in calismasi icin WebView2 Runtime gereklidir.$\r$\nLutfen kurulumdan sonra su adresten 'Evergreen Standalone Installer'i indirip elle calistirin:$\r$\nhttps://developer.microsoft.com/microsoft-edge/webview2/$\r$\n$\r$\nKuruluma devam edilsin mi?" \
      IDOK webview2_ok
    Abort "Kurulum kullanici tarafindan iptal edildi."

  webview2_ok:
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
