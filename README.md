# POS application (Now convert to Procurement Module)
Ini awalnya adalah aplikasi Point of Sales,dibangun dengan REACT(vite) dan terhubung ke IDempiere REST API. Karena adanya pertimbangan kebutuhan, akhirnya Aplikasi ini dirubah/ditambah ke arah Module Procurement, mulai dari Requisition, Purchase Order, Penerimaan Barang dan nantinya juga pemakaian sendiri/internal use.

Untuk aplikasi POS masih bisa diakses, anda cukup menambahkan Link/route di App.js, Sidebar maupun Dasboard yang mengarah ke POSContainer.jsx, untuk POS App ini masih sangat sederhana, silahkan dikembangkan, terutama untuk pembayaran mix (cash, qris dll).

Untuk pengembangan module procurement ada 4 menu utama (Requisition, PO, Goods Receipt dan Internal Use) dengan beberapa fitur diantaranya :
1. Scan barcode
2. Import dari transaksi sebelumnya (Misal pada menu Purchasing kita bisa Import dari Requisition)
3. Form dibuat menyerupai Shopping Cart pada marketplace sehingga user lebih familiar.
   
Aplikasi ini free dengan resiko anda sendiri (masih banyak ekspose console.log untuk pengetesan, kalau untuk production silahan dihapus)

# Mulai menggunakan aplikasi ini

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
