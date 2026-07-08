-- Katalog tohumu + varsayılan ayarlar
INSERT INTO brands (name, sort_order) VALUES
 ('Apple', 1), ('Samsung', 2), ('Xiaomi', 3), ('Huawei', 4),
 ('Oppo', 5), ('Realme', 6), ('Honor', 7), ('General Mobile', 8), ('Tecno', 9);

INSERT INTO models (brand_id, name, storage_options) VALUES
 (1, 'iPhone 11', '[64,128,256]'),
 (1, 'iPhone 12', '[64,128,256]'),
 (1, 'iPhone 13', '[128,256,512]'),
 (1, 'iPhone 14', '[128,256,512]'),
 (1, 'iPhone 14 Pro', '[128,256,512,1024]'),
 (1, 'iPhone 15', '[128,256,512]'),
 (1, 'iPhone 15 Pro Max', '[256,512,1024]'),
 (1, 'iPhone 16', '[128,256,512]'),
 (2, 'Galaxy S21', '[128,256]'),
 (2, 'Galaxy S22', '[128,256]'),
 (2, 'Galaxy S23', '[128,256,512]'),
 (2, 'Galaxy S24', '[128,256,512]'),
 (2, 'Galaxy A54', '[128,256]'),
 (3, 'Redmi Note 12', '[128,256]'),
 (3, 'Redmi Note 13', '[128,256]'),
 (3, 'Mi 13T', '[256]');

INSERT INTO settings (key, value) VALUES
 ('shop_name', '"Telefon Dünyası"'),
 ('currency', '"TRY"'),
 ('default_warranty_months', '6'),
 ('theme', '"light"'),
 ('backup_dir', '""');

INSERT INTO users (username, password_hash, display_name, role) VALUES
 ('admin', '', 'Patron', 'owner');
