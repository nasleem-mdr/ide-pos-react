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

* Clone pada local server anda
* Jalankan `npm install`
* Jalankan `npm install recharts` dependency untuk chart
* Edit vite.config.js/Package.json rubah proxy ke real IDempiere Rest API anda, atau anda bisa gunakan www.demo.globalqss.com untuk testing.
* Jalankan `npm run dev` atau `npx vite`
* Buka browser  [http://localhost:3000](http://localhost:3000) 

* Setup Pos Terminal, product, business partner dan laporan2 masih menggunakan Aplikasi IDempiere, kedepan akan dikembangkan untuk setup melalui aplikasi ini 

### Fitur yang tersedia pada menu POS:
* POINT OF SALES (menu utama)
* List Sales Order harian (dengan total sales)
* Edit Sales Order saat dokumen status masih draft / belum dibayar /belum complete
* Dashboard (Sementara masih sederhana)
* List Business Partner (Belum bisa diedit bro)

### Fitur yang tersedia pada menu Requisition:
* Scan Barcode
* Search dari Value, Name dan Description
* Cart Item - Mobile Friendly

### Fitur yang tersedia pada menu Purchasing:
* Scan Barcode
* Import dari Requisition (sehingga tidak entry manual)
* Search dari Value, Name dan Description
* Cart Item - Mobile Friendly
* 
### Fitur yang tersedia pada menu Goods Receipt:
* Scan Barcode
* Import dari Purchasing (sehingga tidak entry manual)
* Search dari Value, Name dan Description
* Cart Item - Mobile Friendly
