import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../data/repositories/till_repository.dart';
import 'pdf_text.dart';

const _blue = PdfColor.fromInt(0xFF2533DB);
const _grayLabel = PdfColor.fromInt(0xFF78787E);
const _nearBlack = PdfColor.fromInt(0xFF14141A);
const _footerGray = PdfColor.fromInt(0xFF96969E);
const _divider = PdfColor.fromInt(0xFFE6E6EC);

/// Masaüstü daily-report-pdf.ts ile aynı A5 gün sonu rapor düzeni.
Future<Uint8List> buildDailyReportPdf(DailyReportData data) async {
  final doc = pw.Document();

  final rows = <List<String>>[
    [trAscii('Gunluk Ciro'), formatKurusPlain(data.dailyRevenue)],
    [trAscii('Gunluk Kar'), formatKurusPlain(data.dailyProfit)],
    [trAscii('POS Komisyonu'), formatKurusPlain(data.posCommission)],
    [trAscii('Toplam Masraf'), formatKurusPlain(data.totalExpenses)],
    [trAscii('Satis Sayisi'), '${data.salesCount} adet'],
    [trAscii('Toplam Stok'), '${data.totalStock} adet'],
  ];

  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a5,
      margin: const pw.EdgeInsets.all(24),
      build: (context) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text('NEVA MOBILE',
                  style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _blue)),
            ),
            pw.Center(
              child: pw.Text('Gun Sonu Raporu - ${data.date}',
                  style: const pw.TextStyle(fontSize: 10, color: _grayLabel)),
            ),
            pw.SizedBox(height: 10),
            pw.Divider(color: _divider),
            pw.SizedBox(height: 6),
            for (final row in rows)
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 5),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(row[0], style: const pw.TextStyle(fontSize: 11, color: _grayLabel)),
                    pw.Text(row[1],
                        style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _nearBlack)),
                  ],
                ),
              ),
            pw.SizedBox(height: 6),
            pw.Divider(color: _divider),
            pw.Spacer(),
            pw.Center(
              child: pw.Text(
                trAscii('Bu rapor NEVA MOBILE tarafından otomatik olarak oluşturulmuştur.'),
                style: const pw.TextStyle(fontSize: 8.5, color: _footerGray),
              ),
            ),
          ],
        );
      },
    ),
  );

  return doc.save();
}

String dailyReportFileName(String date) => 'Gun_Sonu_Raporu_$date.pdf';
