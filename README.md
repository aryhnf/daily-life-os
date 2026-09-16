# Daily OS

Local-first PWA untuk daily routine, body/workout, skincare, plan, dan consistency tracker.

## Fitur MVP
- First-run onboarding routine.
- Daily Routine tanpa jam: cukup pilih aktivitas dan hari aktif.
- Today sebagai hub gabungan Routine + Body + Skincare + Must Do.
- Swipe kiri pada card Today untuk `Skip today` tanpa mengubah template permanen.
- Body tracker (Gym, Running, Walking, dll) dengan target dan actual result.
- Skincare morning/night + hari aktif.
- Plan board: Idea → Akan Dilakukan → Harus Dilakukan.
- Planned item otomatis tampil sebagai Must Do saat due date tiba.
- Drag plan card antar lane menggunakan handle.
- Notes pada setiap item Plan.
- Daily note + mood.
- Consistency tracker, heatmap 30 hari, per-item completion, streak, weekly review.
- Archive template tanpa menghapus history.
- Quick Add untuk aktivitas khusus hari ini.
- Export / import backup JSON.
- IndexedDB local storage dengan localStorage fallback.
- Service Worker + manifest untuk offline/PWA.

## Perubahan v2 — Daily Routine tanpa jam
- Daily Routine sekarang tidak memakai jam.
- Onboarding cukup memilih aktivitas; tidak ada langkah pengaturan waktu.
- Routine hanya memilih hari aktif, kategori, minimum version, tracking, dan notes.
- Di Today, Daily Routine muncul sebagai checklist terpisah tanpa timestamp.
- Waktu tetap opsional untuk Body, Skincare, Plan, dan Quick Add.
- Data routine lama yang memiliki jam tetap kompatibel; jam tersebut diabaikan pada Daily Routine.

## Jalankan lokal
Karena service worker membutuhkan HTTP(S), jangan buka `index.html` langsung dengan `file://`.

```bash
python3 -m http.server 8080
```

Buka `http://localhost:8080`.

## Deploy ke GitHub Pages
1. Repository ini memakai branch `main`.
2. GitHub → repository → **Settings → Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**.
4. Branch: `main`, folder: `/ (root)`, lalu Save.
5. Setelah URL Pages aktif, buka URL tersebut di Safari iPhone.
6. Safari → Share → **Add to Home Screen**.

Semua path menggunakan relative URL sehingga aman jika GitHub Pages berada di subpath repository.

## Storage
Data disimpan pada browser/perangkat. Gunakan Settings → Export Backup secara berkala. Menghapus site data / browser storage dapat menghapus database lokal.
