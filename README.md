# POS application (Now convert to Procurement Module)
Aplikasi ini awalnya dibangun untuk Point of Sales, dengan pertimbangan kebutuhan, aplikasi ini dikembagkan untuk module Procurement.

Aplikasi ini dibangun dengan REACT(vite) dan terhubung ke IDempiere REST API. Adapun module Procurement yang dimaksud disini adalah mulai dari Requisition, Purchase Order, Penerimaan Barang(Material Receipt/Goods Receipt) dan pemakaian sendiri/internal use(incentory Decrease/Increase)

Untuk aplikasi POS masih bisa diakses, anda cukup menambahkan Link/route di App.js, Sidebar maupun Dasboard yang mengarah ke POSContainer.jsx, untuk POS App ini masih sangat sederhana, silahkan dikembangkan, terutama untuk pembayaran mix (cash, qris dll).

Untuk pengembangan module procurement ada 4 menu utama (Requisition, PO, Material Receipt dan Internal Use) dan dan juga laporan-laporan atau daftar transakai.
Berikut adalah beberapa fitur yang tersedia:
1. Scan barcode/qrcode untuk input transaksi/barang.
2. Import dari transaksi sebelumnya (Misal pada menu Purchasing kita bisa Import dari Requisition)
3. Form dibuat menyerupai Shopping Cart pada marketplace sehingga user lebih familiar.
   
Aplikasi ini free open source dengan resiko anda sendiri (masih banyak ekspose console.log untuk pengetesan, kalau untuk production silahan dihapus)

# Mulai mengembangkan dan menggunakan aplikasi ini
### Prerequisition
* React/Vite versi 8
* Dependency:
npm install recharts
npm install jspdf jspdf-autotable qrcode

jika anda membutuhkan validasi document anda bisa menggunakan express.js sebagai servlet melayani validasi ini (ada pada project berbeda)

### Mulai menggunakan 
* Clone pada local server anda
* Jalankan `npm install`
* Edit vite.config.js/Package.json rubah proxy ke real IDempiere Rest API anda, atau anda bisa gunakan www.demo.globalqss.com untuk testing.
* Jalankan `npm run dev` atau `npx vite`
* Buka browser  [http://localhost:3000](http://localhost:5171) atau yang muncul di terminal anda.

### Struktur Folder 
ide-pos-react/
├── public/              # Aset statis (index.html, favicon, dll.)
├── src/
│   ├── assets/          # Gambar, logo, dan file font global
│   ├── components/      # Komponen UI yang reusable (Button, Modal, Input)
│   ├── context/         # State management global (jika menggunakan React Context)
│   ├── hooks/           # Custom React Hooks (misal: useCart, useAuth)
│   ├── pages/           # Komponen halaman utama (Dashboard, Kasir/POS, Laporan)
│   ├── services/        # Integrasi API / Axios HTTP Requests
│   ├── utils/           # Fungsi pembantu / helper (format mata uang, enkripsi data)
│   ├── App.js           # Komponen root dan konfigurasi routing
│   └── index.js         # Entry point aplikasi
├── .gitignore
├── package.json
└── README.md
