import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// PDF/yedek dosyasını geçici dizine yazıp Android paylaşım sayfasını açar
/// (masaüstündeki "kaydet" dialog'unun mobil karşılığı — kullanıcı buradan
/// dosya yöneticisine/WhatsApp'a/Drive'a kaydedebilir).
Future<void> saveAndShareBytes(Uint8List bytes, String fileName, {String? shareText}) async {
  final dir = await getTemporaryDirectory();
  final path = p.join(dir.path, fileName);
  final file = File(path);
  await file.writeAsBytes(bytes, flush: true);
  await Share.shareXFiles([XFile(path)], text: shareText);
}
