# Point of Sales application
Ini adalah aplikasi Point of Sales yang dibangun dengan REACT(vite) dan terhubung ke IDempiere REST API.

Aplikasi ini masih sangat sederhana, silahkan dikembangkan, terutama untuk pembayaran mix (cash, qris dll).
Aplikasi ini free dengan resiko anda sendiri (masih banyak ekspose console.log untuk pengetesan, kalau untuk production silahan dihapus)

# Mulai menggunakan aplikasi ini

* Clone pada local server anda
* Jalankan `npm install`
* Edit Package.json rubah proxy ke real IDempiere Rest API anda, atau anda bisa gunakan www.demo.globalqss.com untuk testing.
* Jalankan `npm run dev` atau `npx vite`
* Buka browser  [http://localhost:3000](http://localhost:3000) 

* Setup Pos Terminal, product, business partner dan laporan2 masih menggunakan Aplikasi IDempiere, kedepan akan dikembangkan untuk setup melalui aplikasi ini 

### Fitur yang tersedia:
* POINT OF SALES (menu utama)
* List Sales Order harian (dengan total sales)
* Edit Sales Order saat dokumen status masih draft / belum dibayar /belum complete
* Dashboard (Sementara masih sederhana)
* List Business Partner (Belum bisa diedit bro)

### Fitur yang belum tersedia:
* POS Session 
* Mix Payment akan asyik jika bisa disambungkan ke QRIS
* Tranfer Cash Register ke Kas Finance/Bendahara 
* Laporan dan setup masih menggunakan aplikasi IDempiere

