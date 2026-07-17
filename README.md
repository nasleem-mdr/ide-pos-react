# IDE Procurement & POS System (React + iDempiere REST Integration)

Aplikasi klien berbasis React yang awalnya dibangun untuk sistem Kasir (*Point of Sale*), kini telah dikembangkan menjadi modul **Procurement (Pengadaan Barang)** ujung-ke-ujung yang terintegrasi langsung dengan **iDempiere ERP REST API**.

Aplikasi ini bersifat *free & open-source*. 
*(Catatan Produksi: Masih banyak baris `console.log` aktif untuk keperluan debugging/pengujian lokal. Pastikan untuk membersihkannya sebelum naik ke lingkungan production).*

---

## 🚀 Fitur Utama

1. **Modul Pengadaan Lengkap:** Mendukung alur kerja dari *Requisition*, *Purchase Order*, *Material/Goods Receipt*, hingga *Internal Use (Inventory Decrease/Increase)*.
2. **Scan Barcode & QR Code:** Input entri barang/transaksi secara instan menggunakan perangkat pemindai.
3. **Alur Kerja Interaktif (Shopping Cart Style):** Panel formulir transaksi dirancang menyerupai keranjang belanja *marketplace* agar ramah pengguna (*user-friendly*).
4. **Impor Transaksi Berjenjang:** Mempercepat proses entri dengan fitur tarik data dari dokumen sebelumnya (contoh: membuat PO langsung dari data Requisition yang telah disetujui).
5. **Validasi Dokumen Publik (Tanpa Login):** Menyediakan gerbang verifikasi status dokumen bagi pihak luar (vendor) melalui pemindaian QR Code (didukung oleh Servlet Express).

> 💡 **Informasi untuk Sistem POS:**
> Fitur POS utama masih aktif dan dapat digunakan. Anda cukup mendaftarkan ulang komponen `POSContainer.jsx` ke dalam berkas `App.js`, `Sidebar.jsx`, atau `Dashboard.jsx`. Fitur POS ini masih sangat dasar dan terbuka untuk dikembangkan lebih lanjut (misalnya penambahan metode pembayaran *mixed-cash* atau QRIS).

---

## 🛠️ Panduan Memulai & Pengembangan Lokal

### Prasyarat (Prerequisites)
* **Node.js & NPM** (Direkomendasikan versi LTS terbaru)
* **React / Vite v5.x ke atas** *(Catatan: Pastikan versi runtime Node Anda mendukung Vite terbaru)*

### Dependencies Utama Proyek
```bash
npm install recharts jspdf jspdf-autotable qrcode react-router-dom
```

### Langkah Instalasi
1. Clone pada local server anda
   ```text
   git clone [https://github.com/nasleem-mdr/ide-pos-react.git](https://github.com/nasleem-mdr/ide-pos-react.git)
   cd ide-pos-react
   ```
2. Install paket dependency
   ```bash
   npm install
   ```
3. Konfigurasi Proksi API:
   Buka file vite.config.js atau package.json Anda, lalu arahkan konfigurasi proxy ke URL endpoint iDempiere REST API asli milik perusahaan Anda. Untuk keperluan pengujian awal, Anda dapat memanfaatkan server demo di    www.demo.globalqss.com.
4. Jalankan server
   ```
   npm run dev
   ```
5. Akses antarmuka aplikasi melalui alamat lokal yang tertera pada terminal Anda (biasanya di http://localhost:5173).
   
📁 Struktur Folder Proyek

```
ide-pos-react/
├── public/              # Aset statis (index.html, favicon, dll.)
├── src/
│   ├── assets/          # Gambar, logo, dan file font global
│   ├── components/      # Komponen UI yang reusable (Button, Modal, Input)
│   ├── config/  
│   ├── context/         # State management global (jika menggunakan React Context)
│   ├── hooks/           # Custom React Hooks (misal: useCart, useAuth)
│   ├── pages/           # Komponen halaman utama (Dashboard, Kasir/POS, Laporan) 
│   ├── utils/           # Fungsi Api IDempiere dan pembantu / helper
│   ├── App.js           # Komponen root dan konfigurasi routing
│   └── index.js         # Entry point aplikasi
├── .gitignore
├── package.json
├── vite.config.json
└── README.md
```

🔄 Alur Fungsionalitas Modul Procurement

<img width="1479" height="703" alt="image" src="https://github.com/user-attachments/assets/05f80e1f-2092-438c-ad0c-7e28a16de2df" />

🔑 Login dan Role Access

Login system menggunakan 2 step authentification sebagaimana yang digunakan pada IDempiere.
Pengguna login — data sesi (Client, Role, Organisasi, Gudang) otomatis terisi berdasarkan hak akses pengguna.

1. Menu Requisition
   Deskripsi
   Modul ini digunakan oleh staf/unit kerja untuk mengajukan permintaan barang secara digital, menggantikan formulir kertas. Setiap FPB berisi daftar produk beserta jumlah yang diminta, dan akan melalui proses persetujuan    berjenjang sebelum dapat diproses lebih lanjut (dibelikan atau diambil dari gudang).
   Alur Pengisian Formulir
   a.	Pengguna login — data sesi (Client, Role, Organisasi, Gudang) otomatis terisi berdasarkan hak akses pengguna.
   b.	Pilih menu Requisition pada Dashboard atau Sidebar
   c.	Pilih (scan atau search) produk yang ingin diminta — daftar produk otomatis difilter berdasarkan gudang (M_Locator_ID) tempat pengguna bertugas.
   d.	Pilihan produk akan disimpan pada Cart Panel disisi kanan(desktop) atau tersembunyi/mengambang dibawah untuk versi mobile.
   e.	Tentukan jumlah (Qty) dan satuan (UOM) — sistem mendukung konversi satuan (mis. Dus ↔ Pcs) menggunakan tabel konversi UOM di iDempiere.
   f.	Ulangi untuk setiap produk yang dibutuhkan hingga daftar permintaan lengkap.
   g.	Submit/Kirim Requisition/FPB — dokumen tersimpan mengikuti alur Workflow Engine IDempiere dengan status InProgress (complete dari sisi Invoker), kemudian dokumen masuk ke antrian approval.
   h.	Approval masih diproses melalui Workflow Activities di Windows iDempiere. 
<img width="1056" height="500" alt="image" src="https://github.com/user-attachments/assets/0d939a69-25c8-474c-8c62-4ee25103f8d2" />

<img width="1056" height="415" alt="image" src="https://github.com/user-attachments/assets/400ba59a-3aca-4cd1-baa0-3e1a7fe0645f" />


2. Menu Purchasing
   Secara tampilan hampir sama dengan formulir requisition, perbedaannya, ada tambahan menu import (dari requisition complete/approved) disebelah input search dan scan
3. Menu Material Receipt/Goods Receipt
   Sama seperti formulir Purchasing, penambahan cart bisa diambil dari PO Complete
4. Menu Internal Use
   Yang membedakan Formulir ini adalah adanya tambahan Field Charge pada cart panel, karena c_charge_id adalah field mandatory pada m_inventoryline, yang secara default diisi menggunakan Custom field di table M_Product (tambahkan c_charge_id melalui Aplication Dictionary).
   Tips Konfigurasi ERP: Pengembang disarankan menambahkan custom field c_charge_id pada tabel M_Product melalui menu Application Dictionary (AD) di iDempiere agar nilai default-nya dapat dimuat secara otomatis.
   
## 🔄 Alur Kerja Verifikasi & Validasi Dokumen (Procurement Workflow)

Sistem verifikasi dokumen untuk Vendor (Requisition & Purchasing) dibagi menjadi dua fase pengembangan:

### 🟢 FASE 1: Verifikasi Status Dokumen Bersih (Status Saat Ini - Produksi)
Saat ini, sistem berfungsi sebagai alat **Verifikasi Validitas Mandiri (Read-Only Verification)**:
1. Staff Internal mencetak Purchase Order (PO) / Requisition yang dilengkapi QR Code berisi URL publik unik berbasis UUID.
2. Vendor menerima dokumen (fisik/PDF) dan memindai QR Code menggunakan ponsel.
3. Browser membuka halaman publik React POS (`/view/order/:uuid`) tanpa perlu login.
4. Aplikasi memanggil Servlet Express untuk mencocokkan UUID dengan database iDempiere ERP.
5. Layar menampilkan data validitas: Nama Barang, Kuantitas, Tanggal, dan Status Terkini dokumen di ERP (apakah *Approved*, *Void*, atau *Draft*) untuk memastikan dokumen tidak dipalsukan.

---

### 🔵 FASE 2: Legalitas Tanda Tangan Digital Bersama DocuSign (Rencana Pengembangan / Roadmap)
*Catatan: Fitur ini sedang dalam tahap perancangan teknis dan belum diimplementasikan di lingkungan produksi.*

Untuk kebutuhan legalitas formal hukum, alur verifikasi akan ditingkatkan dengan integrasi **DocuSign API**:
* **Embedded Signing:** Pada halaman publik React POS, akan ditambahkan tombol "Tanda Tangani Dokumen".
* **Automated Webhook:** Setelah Vendor menandatangani dokumen di platform DocuSign, Servlet Express akan menerima notifikasi Webhook (`Envelope: Completed`) dan otomatis mengubah *DocStatus* di iDempiere ERP menjadi `Signed / Closed`.
```text
                                 ┌────────────────────────┐
                                 │    iDempiere ERP       │
                                 │  (Sistem Core & DB)    │
                                 └───────────▲────────────┘
                                             │
                       (1) REST API          │ (3) Ambil & Update Status
                       Transaksi             │     Dokumen ERP
                                             │
  ┌────────────────────────┐     (2) QR Code │     ┌────────────────────────┐
  │      React POS         ├─────────────────┼─────►    Servlet Express     │
  │ (Aplikasi Internal)    │     URL Link    │     │  (Validasi & Webhook)  │
  └────────────────────────┘                 │     └───────────▲────────────┘
                                             │                 │
                                             │                 │ (4) Kirim Envelope /
                                             │                 │     Status Webhook
                                             │     ┌───────────┴────────────┐
                                             └─────┤    DocuSign API        │
                                                   │   (Legalitas TTD)      │
                                                   └───────────▲────────────┘
                                                               │
                                                               │ (5) Tanda Tangan
                                                               │     Digital
                                                   ┌───────────┴────────────┐
                                                   │     External Vendor    │
                                                   │  (Penerima Order/PO)   │
                                                   └────────────────────────┘
```
