import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'pdf_text.dart';

class ReceiptData {
  final int saleId;
  final String model;
  final String? imei;
  final String date;
  final int price;
  final String paymentLabel;
  final int commissionAmount;
  final String? warrantyText;
  final String? buyerName;

  ReceiptData({
    required this.saleId,
    required this.model,
    this.imei,
    required this.date,
    required this.price,
    required this.paymentLabel,
    this.commissionAmount = 0,
    this.warrantyText,
    this.buyerName,
  });
}

const _blue = PdfColor.fromInt(0xFF2533DB);
const _grayLabel = PdfColor.fromInt(0xFF78787E);
const _nearBlack = PdfColor.fromInt(0xFF14141A);
const _footerGray = PdfColor.fromInt(0xFF96969E);
const _divider = PdfColor.fromInt(0xFFE6E6EC);

/// Masaüstü receipt-pdf.ts ile aynı A5 fiş düzeni.
Future<Uint8List> buildReceiptPdf(ReceiptData data) async {
  final doc = pw.Document();
  final netTotal = data.price - data.commissionAmount;

  final rows = <List<String>>[
    [trAscii('Telefon Modeli'), trAscii(data.model)],
    [trAscii('IMEI'), data.imei ?? '-'],
    [trAscii('Satış Tarihi'), trAscii(data.date)],
    [trAscii('Alıcı Adı'), data.buyerName != null ? trAscii(data.buyerName!) : '-'],
    [trAscii('Ödeme Türü'), trAscii(data.paymentLabel)],
    [trAscii('Satış Fiyatı'), formatKurusPlain(data.price)],
    if (data.commissionAmount > 0)
      [trAscii('Banka Komisyonu'), '-${formatKurusPlain(data.commissionAmount)}'],
    [trAscii('Garanti'), data.warrantyText != null ? trAscii(data.warrantyText!) : 'Yok'],
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
              child: pw.Text(trAscii('Telefon Alım Satım Yönetim Sistemi'),
                  style: const pw.TextStyle(fontSize: 10, color: _grayLabel)),
            ),
            pw.SizedBox(height: 10),
            pw.Divider(color: _divider),
            pw.SizedBox(height: 6),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(trAscii('Satış Fişi'),
                    style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: _nearBlack)),
                pw.Text('Fis No: #${data.saleId}', style: const pw.TextStyle(fontSize: 9, color: _grayLabel)),
              ],
            ),
            pw.SizedBox(height: 8),
            for (final row in rows)
              pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 3.5),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(row[0], style: const pw.TextStyle(fontSize: 10.5, color: _grayLabel)),
                    pw.Text(row[1],
                        style: pw.TextStyle(
                            fontSize: 10.5, fontWeight: pw.FontWeight.bold, color: _nearBlack)),
                  ],
                ),
              ),
            pw.SizedBox(height: 6),
            pw.Divider(color: _divider),
            pw.SizedBox(height: 6),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(trAscii('Kasaya Giren'),
                    style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _blue)),
                pw.Text(formatKurusPlain(netTotal),
                    style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold, color: _blue)),
              ],
            ),
            pw.Spacer(),
            pw.Center(
              child: pw.Text(
                trAscii('Bu fiş NEVA MOBILE tarafından otomatik olarak oluşturulmuştur.'),
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

String receiptFileName(int saleId) => 'Satis_Fisi_$saleId.pdf';
