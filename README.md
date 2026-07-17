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
