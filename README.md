# POS application (Now convert to Procurement Module)
Aplikasi ini awalnya dibangun untuk Point of Sales, dengan pertimbangan kebutuhan, aplikasi ini dikembagkan untuk module Procurement.

Aplikasi ini dibangun dengan REACT(vite) dan terhubung ke IDempiere REST API. Adapun module Procurement yang dimaksud disini adalah mulai dari Requisition, Purchase Order, Penerimaan Barang(Material Receipt/Goods Receipt) dan pemakaian sendiri/internal use(incentory Decrease/Increase)

Untuk aplikasi POS masih bisa diakses, anda cukup menambahkan Link/route di App.js, Sidebar maupun Dasboard yang mengarah ke POSContainer.jsx, untuk POS App ini masih sangat sederhana, silahkan dikembangkan, terutama untuk pembayaran mix (cash, qris dll).

Untuk pengembangan module procurement ada 4 menu utama (Requisition, PO, Material Receipt dan Internal Use) dan dan juga laporan-laporan atau daftar transakai.
Berikut adalah beberapa fitur yang tersedia:
1. Scan barcode/qrcode untuk input transaksi/barang.
2. Import dari transaksi sebelumnya (Misal pada menu Purchasing kita bisa Import dari Requisition)
3. Form dibuat menyerupai Shopping Cart pada marketplace sehingga user lebih familiar.
4. Jika anda membutuhkan validasi document anda bisa menggunakan express.js sebagai servlet melayani validasi ini (penjelasan detail lihat pada alur kerja verifikasi data)

   
Aplikasi ini free open source dengan resiko anda sendiri (masih banyak ekspose console.log untuk pengetesan, kalau untuk production silahan dihapus)

# Mulai mengembangkan dan menggunakan aplikasi ini
### Prerequisition
* React/Vite versi 8
* Dependency:
npm install recharts
npm install jspdf jspdf-autotable qrcode


### Mulai menggunakan 
* Clone pada local server anda
* Jalankan `npm install`
* Edit vite.config.js/Package.json rubah proxy ke real IDempiere Rest API anda, atau anda bisa gunakan www.demo.globalqss.com untuk testing.
* Jalankan `npm run dev` atau `npx vite`
* Buka browser  [http://localhost:3000](http://localhost:5171) atau yang muncul di terminal anda.

### Struktur Folder 

``` ide-pos-react/
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
└── README.md
```

### Fungsionalitas Aplikasi
Saat ini pengembang memfokuskan pada module procurement dengan menu utama (Requisition, Purchasing, Material Receipt dan Internal Use)
<img width="1479" height="703" alt="image" src="https://github.com/user-attachments/assets/05f80e1f-2092-438c-ad0c-7e28a16de2df" />
1. Menu Requisition
   Deskripsi
   Modul ini digunakan oleh staf/unit kerja untuk mengajukan permintaan barang secara digital, menggantikan formulir kertas. Setiap FPB berisi daftar produk beserta jumlah yang diminta, dan akan melalui proses persetujuan    berjenjang sebelum dapat diproses lebih lanjut (dibelikan atau diambil dari gudang).
   Alur Pengisian Formulir
   1.	Pengguna login — data sesi (Client, Role, Organisasi, Gudang) otomatis terisi berdasarkan hak akses pengguna.
   2.	Pilih menu Requisition pada Dashboard atau Sidebar
   3.	Pilih (scan atau search) produk yang ingin diminta — daftar produk otomatis difilter berdasarkan gudang (M_Locator_ID) tempat pengguna bertugas.
   4.	Pilihan produk akan disimpan pada Cart Panel disisi kanan(desktop) atau tersembunyi/mengambang dibawah untuk versi mobile.
   5.	Tentukan jumlah (Qty) dan satuan (UOM) — sistem mendukung konversi satuan (mis. Dus ↔ Pcs) menggunakan tabel konversi UOM di iDempiere.
   6.	Ulangi untuk setiap produk yang dibutuhkan hingga daftar permintaan lengkap.
   7.	Submit/Kirim Requisition/FPB — dokumen tersimpan mengikuti alur Workflow Engine IDempiere dengan status InProgress (complete dari sisi Invoker), kemudian dokumen masuk ke antrian approval.
   8.	Approval masih diproses melalui Workflow Activities di Windows iDempiere. 
<img width="1056" height="500" alt="image" src="https://github.com/user-attachments/assets/0d939a69-25c8-474c-8c62-4ee25103f8d2" />

<img width="1056" height="415" alt="image" src="https://github.com/user-attachments/assets/400ba59a-3aca-4cd1-baa0-3e1a7fe0645f" />


3. Menu Purchasing
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
