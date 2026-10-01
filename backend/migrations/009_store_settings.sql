BEGIN;

CREATE TABLE IF NOT EXISTS store_settings (
    id INTEGER PRIMARY KEY,
    shop_name VARCHAR(160) NOT NULL DEFAULT 'Adrenalin Qazi',
    support_phone VARCHAR(30),
    support_telegram VARCHAR(100),
    store_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    shop_image_url VARCHAR(500),
    guide_text TEXT NOT NULL DEFAULT 'Mahsulot tanlang, savatga qo''shing va buyurtmani rasmiylashtiring. Manzil va yetkazish joyi rasmini tekshirib yuboring.',
    terms_text TEXT NOT NULL DEFAULT 'Buyurtma yuborilgach mahsulotlar 12 soatgacha band qilinadi. Hozircha onlayn to''lov ulanmagan; buyurtma to''langan deb hisoblanmaydi.',
    updates_text TEXT NOT NULL DEFAULT 'Yangi funksiyalar va muhim o''zgarishlar shu yerda e''lon qilinadi.'
);

INSERT INTO store_settings (id, shop_name, guide_text, terms_text, updates_text)
VALUES (
    1,
    'Adrenalin Qazi',
    'Mahsulot tanlang, savatga qo''shing va buyurtmani rasmiylashtiring. Manzil va yetkazish joyi rasmini tekshirib yuboring.',
    'Buyurtma yuborilgach mahsulotlar 12 soatgacha band qilinadi. Hozircha onlayn to''lov ulanmagan; buyurtma to''langan deb hisoblanmaydi.',
    'Yangi funksiyalar va muhim o''zgarishlar shu yerda e''lon qilinadi.'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
