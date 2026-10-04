# Adrenalin Qazi

Adrenalin Qazi - Telegram ichida ochiladigan oziq-ovqat do'koni, admin panel, FastAPI backend va PostgreSQL bazasidan iborat loyiha.

## Loyiha tarkibi

- `frontend/` - mijozlar do'koni: katalog, qidiruv, savat, profil, lokatsiya va buyurtmalar.
- `admin/` - egaga mo'ljallangan panel: dashboard, buyurtmalar, Hamyon to'lovlari, mahsulotlar, kategoriyalar, mijozlar, CSV hisobot va tizim holati.
- `backend/` - Telegram autentifikatsiyasi, API, buyurtmalar, ombor bandi va bot.
- `backend/migrations/` - PostgreSQL uchun SQL migrationlar.
- `backend/uploads/` - do'kon, mahsulot, kategoriya va buyurtma rasmlari. Yuklangan fayllar repoga kiritilmaydi.

## Hozir ishlaydigan qismlar

- Bot `/start` orqali har qanday foydalanuvchiga mijozlar do'konini ochadi. Do'kon egasi admin panelga o'tish uchun `/admin` yuboradi; `/shop` mijozlar do'koniga qaytaradi.
- Telegram Mini App yuborgan imzolangan `initData` backendda tekshiriladi. Foydalanuvchi ID'si shu imzodan olinadi; `initDataUnsafe` server autentifikatsiyasi sifatida ishlatilmaydi.
- Mijoz profili ism, familiya, telefon, manzil, orientir va GPS koordinatalarini saqlaydi. Profil rasmi majburiy emas; mijozlarga do'kon rasmi va do'kon lokatsiyasi ko'rsatiladi.
- Katalog, kategoriya, qidiruv, mahsulot tafsiloti va saqlanadigan savat mavjud.
- Saqlangan profil va manzil bilan buyurtmani tez rasmiylashtirish mumkin. Yetkazish manzili rasmini (JPG/PNG/WEBP, 5 MB gacha) biriktirish shart; xarita, telefon va manzilni tahrirlash, izoh, sana va vaqt kiritish mumkin. Rasm yuklangan asl fayl holida saqlanadi; ko'rishda kesilmaydi, tafsilotda asl rasmni alohida ochish mumkin.
- Checkoutdagi Yandex Go tugmasi mijoz tanlagan manzilni va do'kon lokatsiyasini Yandex Go ilovasiga yo'naltiradi. Yandex Go o'zida yo'nalish hamda amaldagi narxni ko'rsatadi; loyiha Yandex tarif API'sidan foydalanmaydi va yetkazish haqini buyurtmaga qo'shmaydi.
- Buyurtmada manzil, koordinata, orientir, telefon va manzil rasmi alohida saqlanadi. Keyin profil tahrirlansa, eski buyurtma o'zgarmaydi. Manzil rasmi admin buyurtma tafsilotida ko'rinadi.
- Buyurtma holatlari: `PAYMENT_PENDING`, `PAID`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERING`, `DELIVERED`, `CANCELLED`. O'zgarishlar tarixi bazada saqlanib, admin buyurtma tafsilotida ko'rinadi.
- Mahsulot qoldigi buyurtma ochilganda sotilgan hisoblanmaydi. Miqdor odatda 12 soat band qilinadi; muddat tugaganda yoki admin buyurtmani bekor qilganda band boshatiladi. Backend API ishga tushganida bandlarni har daqiqada tekshiradi. To'lovni backend tasdiqlagandagina haqiqiy qoldiq kamayadi.
- Ombor sahifasida boshlang'ich kirim, keyingi kirim, qaytarish, qo'lda tuzatish va tasdiqlangan sotuv yozuvlari ko'rinadi. Band qoldiq alohida hisoblanadi; har bir yozuv admin ID, vaqt, mahsulot va buyurtma bilan bog'lanadi.
- Egaga yangi buyurtma haqida Telegram xabari bor. Buyurtma yetkazishga chiqarilganda, yetkazilganda yoki bekor qilinganda mijozga Telegram xabari yuboriladi.
- Admin API egasining `ADMIN_TELEGRAM_ID` qiymati bilan cheklangan. Admin sahifalari Telegram ichida egasining akkaunti bilan ochiladi.
- Qisqa muddatli Telegram initData tekshirilgach, API uchun 12 soatlik xotira tokeni olinadi. Frontend tokenni brauzer xotirasida saqlab, 401 javobida sessiyani yangilaydi; eskirgan initData sababli har bir so'rovda sessiya xatosi chiqmaydi.
- Admin mahsulot/kategoriya CRUD, buyurtma ro'yxati, mijozlar tafsiloti, dashboard statistikasi va Excel'da ochiladigan CSV hisobot bilan ishlaydi.
- Admin sozlamalarida do'kon rasmi, nomi, aloqa telefoni, Telegram manzili, lokatsiya, mijozlar qo'llanmasi, foydalanish shartlari va yangilanishlar matnini boshqarish mumkin.
- Mijoz Profil bo'limida do'kon lokatsiyasini xaritada, aloqa ma'lumotlarini hamda qo'llanma, shartlar va yangilanishlarni ko'radi.

## Hozircha ulanmagan yoki cheklangan qismlar

Quyidagilar production funksiyasi deb hisoblanmaydi:

- **Hamyon API · UZCARD:** to'lov yaratish, imzolangan `prepare`/`complete` callback, qayta yuborilgan callback'larni idempotent qayta ishlash, timeout/late-payment holatlari va admin to'lovlar ro'yxati ulangan. Haqiqiy to'lovni yoqish uchun Hamyon merchant kalitlari, shifrlash kaliti, callback sozlamalari va provayder bilan jonli tekshiruv talab qilinadi.
- **Hisobot:** buyurtma va mahsulot qatorlarini CSV qilib yuklash mumkin. Foyda tannarxi, mijoz bo'yicha xaridlar va alohida kun/hafta/oy analitikasi hozircha to'liq emas.
- **Nasiya/qarz, promo-kod, chegirma, referral, cashback va kuryer boshqaruvi** mavjud emas.
- API Redis orqali barcha workerlar o'rtasida rate limit qo'llaydi. Production'da `REDIS_URL` shart; Redis ishlamasa server ishga tushmaydi. Limitlar: global 60/min/IP, buyurtma 5/min/foydalanuvchi, profil va upload 10/min/foydalanuvchi, admin mutation 30/min/admin.
- Qarz, promo va kuryer boshqaruvi hozircha mavjud emas. Buyurtma holati tarixi, ombor harakati va Hamyon tranzaksiyalari alohida qayd qilinadi.
- **Sozlamalar sahifasi** do'kon ma'lumotlari, aloqa, lokatsiya, rasm va mijozlarga ko'rsatiladigan matnlarni boshqaradi. Server sirlarini (`.env`) ilova ichidan tahrirlamaydi.
- Hamyon kabinetida `prepare_url` va `complete_url` ni `https://<backend-host>/payments/callbacks/prepare` hamda `https://<backend-host>/payments/callbacks/complete` qilib sozlang. Backend ushbu callback'lardagi Hamyon imzosini va buyurtma/summani tekshiradi.

Kod test va sozlashga tayyor. Jonli savdo uchun Hamyon merchant kalitlari/callback'lari, egasining Telegram ID'si va HTTPS manzillar kerak. Yandex Go ilovasiga yo'naltirish API kalitini talab qilmaydi.

## Talablar

- Windows 10/11 yoki Linux/macOS.
- Python 3.11 yoki yangiroq.
- Node.js LTS va npm.
- PostgreSQL 14 yoki yangiroq.
- Telegram BotFather'dan olingan bot tokeni (botni ishga tushirish uchun).
- Egasi/adminning musbat raqamli Telegram ID'si.
- Telegram'da haqiqiy ishlatish uchun internetdan ochiladigan HTTPS domen yoki HTTPS tunnel.

## 1. PostgreSQL tayyorlash

PostgreSQL'da `adrenalin_qazi` nomli bo'sh baza yarating. `backend/.env` ichidagi `DATABASE_URL` shu bazaga mos bo'lishi kerak. `.env` fayllardagi maxfiy qiymatlarni repository'ga yubormang va frontendga ko'chirmang.

Migrationlarni **bir marta, tartib bilan** bajaring. `003_verify_order_landmark.sql` 002 migrationdagi ustunni yana xavfsiz tekshiradi:

```powershell
cd backend
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/001_customer_profile.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/002_order_landmark.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/003_verify_order_landmark.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/004_order_delivery_phone.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/005_inventory_reservations.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/006_order_status_history.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/007_inventory_movements.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/008_order_delivery_image.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/009_store_settings.sql
psql "postgresql://USER:PASSWORD@localhost:5432/adrenalin_qazi" -f migrations/010_payments_delivery_fee.sql
```

`USER` va `PASSWORD` o'rniga PostgreSQL foydalanuvchi ma'lumotlarini kiriting. Buyruq terminal tarixida parol qoldirishi mumkin; production'da parolni alohida xavfsiz usulda uzating. Mavjud baza va migrationlar allaqachon qo'llangan bo'lsa, qayta ishlatishdan oldin holatni tekshiring.

## 2. Backend sozlash va ishga tushirish

`backend/.env.example` faylini namuna qilib, `backend/.env` yarating yoki mavjudini tahrirlang. Mavjud `DATABASE_URL` qiymatini saqlang. Quyidagi qiymatlarni muhitga moslang:

```dotenv
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/adrenalin_qazi
BOT_TOKEN=
ADMIN_TELEGRAM_ID=
MINI_APP_URL=https://sizning-domeningiz.uz/shop
ADMIN_PANEL_URL=https://sizning-domeningiz.uz/admin
CORS_ORIGINS=https://sizning-domeningiz.uz
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=300
APP_ENV=production
REDIS_URL=redis://127.0.0.1:6379/0
ORDER_RESERVATION_HOURS=12
MINI_APP_SESSION_TTL_SECONDS=43200
HAMYON_API_BASE_URL=https://hamyon-api.uz
HAMYON_SHOP_ID=
HAMYON_SHOP_KEY=
HAMYON_CARD_ENCRYPTION_KEY=
```

`BOT_TOKEN` va database parolini repoga, issue'ga, frontend `.env` fayliga yoki chatga joylamang. Tokenni faqat `backend/.env` ichiga kiriting.

Hamyon uchun yuqoridagi shop ID/key va Fernet shifrlash kalitini backend muhitiga kiriting. Fernet kalitini `.venv` yoqilgan terminalda `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` bilan yarating. Hamyon kabinetiga callback URL'larni kiriting. Yandex Go yo'nalish havolasi uchun API kalitlari talab qilinmaydi. Ilovada do'kondan mijoz manziligacha yo'nalish chiqarish uchun Admin > Sozlamalar'da do'kon lokatsiyasini kiriting. Maxfiy kalitlarni browser `.env` ga qo'ymang.

PowerShell'da, loyiha ildizidan:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Backend lokal manzili `http://127.0.0.1:8000`; API hujjatlari `http://127.0.0.1:8000/docs`, holat tekshiruvi `/health`.

## 3. Mijoz ilovasini ishga tushirish

Boshqa PowerShell oynasida:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Lokal manzil odatda `http://localhost:5173`. `frontend/.env` dagi `VITE_API_URL` qiymatini backend manziliga moslang (standart: `http://127.0.0.1:8000`). Oddiy brauzerda katalog ko'rinishi mumkin; profil va buyurtma uchun Telegram Mini App yuborgan haqiqiy imzolangan `initData` kerak.

## 4. Admin panelni ishga tushirish

Yana bir PowerShell oynasida:

```powershell
cd admin
Copy-Item .env.example .env
npm ci
npm run dev -- --port 5174
```

Lokal manzil odatda `http://localhost:5174`. Admin panelni Telegram ichida bot ko'rsatgan tugmadan egasining akkaunti bilan oching; oddiy brauzerda admin API ishlamaydi.

## 5. Telegram botni ishga tushirish

`backend/.env` ichida `BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `MINI_APP_URL` va `ADMIN_PANEL_URL` bo'lishi kerak. Botning Mini App URL manzillari HTTPS bo'lishi shart.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
py -m app.bot
```

Admin egasi botga `/start` yuborib mijozlar do'konini ochishi mumkin; admin boshqaruviga o'tish uchun `/admin` yuboradi. Bot egaga yangi buyurtma kelganda xabar yuboradi. Mijoz botni birinchi marta ishga tushirgach do'kon menyusidan foydalanadi.

## 6. Telegram uchun HTTPS domenini sozlash

Telegram Mini App `localhost` emas, internetdan ochiladigan HTTPS manzil talab qiladi. Serverga joylashtirganda:

1. Mijoz ilovasi, admin ilovasi va backend API'ni serverga joylashtiring.
2. `MINI_APP_URL` va `ADMIN_PANEL_URL` qiymatlarini ochiq HTTPS manzillarga o'rnating.
3. `@BotFather` ichida bot domenini `/setdomain` orqali ulang va ko'rsatilgan ko'rsatmalarga amal qiling.
4. `CORS_ORIGINS` ichiga frontend manzillarini kiriting. Har bir qiymat sxema va hostdan iborat bo'lsin; oxirida `/` yozmang.
5. `frontend/.env`, `admin/.env` dagi `VITE_API_URL` ni ochiq backend manziliga sozlab, ikkala ilovani qayta build qiling.
6. Reverse proxy `/shop` yo'lini `frontend/dist` ga, `/admin` yo'lini `admin/dist` ga, API yo'lini FastAPI'ga to'g'ri uzatayotganini tekshiring. HTTPS sertifikati va rasmlar uchun doimiy saqlash joyini sozlang.
7. Avval API, keyin bot va frontend xizmatlarini ishga tushirib, haqiqiy Telegram akkauntida tekshiring.

## 7. Build va kodni tekshirish

```powershell
cd frontend
npm run lint
npm run build
cd ..\admin
npm run lint
npm run build
cd ..\backend
.\.venv\Scripts\python.exe -m compileall -q app
python -m pytest -q
```

## Xavfsizlik va ishlatish eslatmalari

- Egasi `ADMIN_TELEGRAM_ID` orqali belgilanadi; tokenning o'zi admin huquqini bermaydi.
- Brauzer yuborgan `PAID` statusini backend qabul qilmaydi. To'lov tasdig'i faqat provider callback'dan kelishi kerak.
- Yuklangan rasmlar `backend/uploads/` ichida saqlanadi. Production serverda bu katalog uchun doimiy disk va backup sozlang.
- Fizik qoldiqdan tashqari band miqdori alohida yuritiladi. Band bekor qilinganda fizik qoldiq o'zgarmaydi.
- Dashboard daromadga faqat tasdiqlangan to'lovlarni qo'shadi.
- Bot va API'ni alohida process/service sifatida ishga tushiring. Production'da log, restart siyosati, baza backup'i va HTTPS yangilanishini sozlang.
