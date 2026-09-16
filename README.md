# Daily OS

Local-first PWA untuk daily routine, body/workout, skincare, plan, dan consistency tracker.

## Fitur MVP
- First-run onboarding routine.
- Routine dengan jadwal per hari dan custom time per weekday.
- Today sebagai hub gabungan Routine + Body + Skincare + Must Do.
- Today override: ubah jam / skip hanya untuk hari ini.
- Touch drag pada handle Today untuk geser waktu dalam kelipatan 30 menit.
- Swipe kiri pada card Today untuk `Skip today`.
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

## Jalankan lokal
Karena service worker membutuhkan HTTP(S), jangan buka `index.html` langsung dengan `file://`.

```bash
python3 -m http.server 8080
```

Buka `http://localhost:8080`.

## Deploy ke GitHub Pages
1. Buat repository baru di GitHub.
2. Upload seluruh isi folder ini ke branch `main`.
3. GitHub → repository → **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Branch: `main`, folder: `/ (root)`, lalu Save.
6. Setelah URL Pages aktif, buka URL tersebut di Safari iPhone.
7. Safari → Share → **Add to Home Screen**.

Semua path menggunakan relative URL sehingga aman jika GitHub Pages berada di subpath repository.

## Storage
Data disimpan pada browser/perangkat. Gunakan Settings → Export Backup secara berkala. Menghapus site data / browser storage dapat menghapus database lokal.
