# Panduan Deploy Kantin Gozeal ke Vercel

## APA YANG ANDA BUTUHKAN
1. Akun GitHub (gratis) - https://github.com
2. Akun Vercel (gratis) - https://vercel.com
3. Akun Turso (gratis) - https://turso.tech

## LANGKAH 1: Buat Akun GitHub
1. Buka https://github.com → Sign up
2. Buat akun dengan email Anda
3. Buat repository baru:
   - Klik "New repository"
   - Name: kantin-gozeal
   - Set "Private" (atau Public, terserah)
   - Jangan centang "Add README"
   - Klik "Create repository"

## LANGKAH 2: Push Code ke GitHub
Di sandbox ini, saya akan bantu push code ke GitHub Anda.
Anda perlu berikan:
- GitHub username
- GitHub Personal Access Token (PAT)
  (Settings → Developer settings → Personal access tokens → Generate new token)

## LANGKAH 3: Buat Database Turso
1. Buka https://turso.tech → Sign up (pakai GitHub)
2. Buat database:
   - Klik "Create database"
   - Name: kantin-gozeal
   - Klik "Create"
3. Dapat connection string: libsql://kantin-gozeal-xxx.turso.io
4. Buat token: klik database → "Create token"
5. CATAT:
   - DATABASE_URL = libsql://kantin-gozeal-xxx.turso.io
   - DATABASE_AUTH_TOKEN = eyJxxx...

## LANGKAH 4: Deploy ke Vercel
1. Buka https://vercel.com → Sign up (pakai GitHub)
2. Klik "Add New Project"
3. Import repository "kantin-gozeal"
4. Set Environment Variables:
   - DATABASE_URL = libsql://kantin-gozeal-xxx.turso.io
   - DATABASE_AUTH_TOKEN = eyJxxx...
   - SESSION_SECRET = ketik-random-32-karakter
5. Klik "Deploy"
6. Tunggu 2-3 menit → Dapat link: https://kantin-gozeal.vercel.app

## LANGKAH 5: Import Data ke Turso
Setelah deploy, jalankan migration script:
- Saya bantu jalankan di sandbox
- Data 31 karyawan + 10 variant akan di-import ke Turso

## SELESAI!
Link permanen: https://kantin-gozeal.vercel.app
- Tidak akan reset
- Bisa edit code → push ke GitHub → Vercel auto-update
- Database aman di Turso (cloud)

## CATATAN
- WebSocket (real-time) tidak jalan di Vercel (perlu Railway terpisah)
- Tapi aplikasi tetap berfungsi, hanya perlu Refresh manual
- Untuk WebSocket, bisa deploy mini-service ke Railway (gratis)
