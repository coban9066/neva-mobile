; NEVA MOBILE - Windows 7 Legacy Edition NSIS kancalari
; SADECE windows7-legacy branch'inde bulunur.
;
; Neden: Guncel MicrosoftEdgeWebView2Setup.exe bootstrapper'i Windows 7'de calismaz
; (GetPackagesByPackageFamily / KERNEL32.dll hatasi). Bu yuzden webviewInstallMode=skip
; ile bootstrapper devre disi birakildi; WebView2 kontrolu burada elle yapiliyor.
;
; Windows 7'de calisan son WebView2 Runtime: 109.0.1518.140
; Kurulum yolu: Edge 109 kurumsal yukleyicisi + "--msedgewebview --do-not-launch-msedge"
; Yukleyici setup.exe'nin yanina "WebView2Runtime109-x64.exe" adiyla konulmalidir.

!macro NSIS_HOOK_PREINSTALL
  ; Makine seviyesi WebView2 kontrolu
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 webview2_ok
  ; Kullanici seviyesi WebView2 kontrolu
  ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 webview2_ok

  ; WebView2 yok - yaninda tasidigimiz 109 yukleyicisi var mi?
  IfFileExists "$EXEDIR\WebView2Runtime109-x64.exe" 0 no_installer
    DetailPrint "WebView2 Runtime 109 kuruluyor (Windows 7 uyumlu son surum)..."
    ExecWait '"$EXEDIR\WebView2Runtime109-x64.exe" --msedgewebview --do-not-launch-msedge --system-level' $1
    DetailPrint "WebView2 Runtime kurulumu tamamlandi (kod: $1)"
    Goto webview2_ok

  no_installer:
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "WebView2 Runtime bulunamadi.$\r$\n$\r$\nNEVA MOBILE'in calismasi icin WebView2 Runtime 109 (Windows 7 uyumlu son surum) gereklidir.$\r$\nLutfen kurulumdan sonra 'WebView2Runtime109-x64.exe' dosyasini calistirin.$\r$\n$\r$\nKuruluma devam edilsin mi?" \
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
