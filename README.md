SMA ERP & POS App  |  Dokumentasi Fungsional v2.0 

# **DOKUMENTASI FUNGSIONAL APLIKASI** 

SMA ERP & POS App (React Frontend) 

|**Versi Dokumen**|2.0|
|---|---|
|**Tanggal Update**|21 September 2026|
|**Platform Backend**|iDempiere ERP Platform (REST/OData API)|



## **BAB 1: PENDAHULUAN & ARSITEKTUR** 

### **1.1 Gambaran Umum** 

Aplikasi ini adalah ekstensi frontend berbasis web (React) yang dibangun di atas platform iDempiere ERP. Aplikasi ini hadir untuk menyediakan antarmuka yang modern, cepat, intuitif, dan mobile-friendly guna mengoperasikan transaksi sehari-hari — mencakup siklus Procurement, Sales, hingga Bank Statement & Cash Reconciliation. 

Seluruh data transaksi yang diinput melalui aplikasi React disinkronkan secara real-time ke tabel-tabel standar iDempiere (seperti M_Requisition, C_Order, M_InOut, M_Inventory, C_Invoice, C_BankStatement, dsb.) melalui REST/OData API resmi iDempiere. 

### **1.2 Arsitektur Sistem** 

Sistem terdiri dari tiga lapisan utama: 

1. **Frontend React:** Antarmuka pengguna (User Interface) untuk mengelola transaksi Procurement, Sales, dan Rekonsiliasi Kas/Bank. 

2. **iDempiere REST/OData API:** Jembatan data dua arah untuk membaca dan memperbarui data operasional dan transaksi. 

3. **Engine & Reporting Services:** 

   - **Workflow Engine iDempiere:** Memproses persetujuan dokumen (approval chain). 

   - **Plugin Pelaporan (OSGi / JasperReports):** Mencetak dokumen PDF resmi yang dilengkapi dengan QR Code Verifikasi. 

## **BAB 2: STRUKTUR MENU UTAMA** 

Setelah pengguna melakukan autentikasi dan memilih sesi (Client, Role, Organization, Warehouse), sistem menyediakan 3 modul utama yang terbagi menjadi sub-menu fungsional: 

|**Modul**|**Sub-Menu**|**Fungsi Utama**|**Dokumen**<br>**iDempiere**|
|---|---|---|---|
||**Requisition**<br>**(FPB)**|Permintaan barang internal antar<br>divisi/gudang|M_Requisition|
|**Pt**|**Purchasing (PO)**|Pembuatan order pembelian ke<br>vendor berdasarkan FPB|C_Order (PO)|
|**rocuremen**|**Goods Receipt**|Pencatatan penerimaan fisik barang<br>dari vendor|M_InOut (Receipt)|
||**Internal Use**|Pengeluaran barang dari gudang<br>untuk kebutuhan operasional|M_Inventory|
||**POS Sales**|Transaksi Kasir/Toko (Instan Kas atau<br>Piutang)|C_Order /<br>C_Payment|
|**Sales**|**Sales Order - DO**|Transaksi harian pelanggan (Otomatis<br>SO + Shipment M_InOut)|C_Order &<br>M_InOut|
||**Sales Invoice**|Penagihan faktur (Manual atau Import<br>gabungan dari M_InOut)|C_Invoice|
|**Finance**|**Bank Statement**|Pencocokan Kas/Bank, Import<br>Statement, dan Manual Charge|C_BankStatement<br>/ C_Cash|



## **BAB 3: MODUL PROCUREMENT** 

Modul Procurement bertugas mengelola siklus pengadaan barang secara tertelusur (traceable). 

### **3.1 Requisition (FPB — Formulir Permintaan Barang)** 

#### **Tujuan:** 

Memfasilitasi unit kerja untuk mengajukan kebutuhan barang secara digital. 

#### **Fitur Utama:** 

- Filtering produk otomatis berdasarkan lokasi gudang user (M_Locator_ID). 

- Dukungan konversi unit satuan (UOM) otomatis (misal: Dus ↔ Pcs). 

- Integrasi Cart Panel (desktop di sisi kanan, mobile berupa panel mengambang). 

- Begitu dikirim (Submitted), dokumen masuk ke antrian Workflow Approval iDempiere dengan status InProgress. 

### **3.2 Purchasing (Purchase Order / PO)** 

#### **Tujuan:** 

Menerbitkan pesanan pembelian resmi kepada vendor berdasarkan permintaan yang sah. 

#### **Fitur Utama:** 

- **Import dari FPB:** Menarik item barang dari Requisition/FPB yang telah berstatus Approved/Completed. 

- Pengisian detail vendor, kesepakatan harga beli, dan jadwal pengiriman. 

- Mengunci kesepakatan harga sebagai dasar verifikasi saat barang datang. 

### **3.3 Goods Receipt (Penerimaan Barang)** 

#### **Tujuan:** 

Mencatat penerimaan fisik barang di gudang hasil pembelian dari vendor. 

#### **Fitur Utama:** 

- **Import dari PO:** Menampilkan sisa barang yang belum diterima (partial receipt). 

- Grafik progres penerimaan barang visual untuk mempermudah pengecekan. 

- Dukungan pindaian Scan QR / Barcode pada fisik kemasan produk. 

- **Update Stok:** Begitu di-Submit, stok gudang bertambah secara otomatis (M_InOut). 

### **3.4 Internal Use (Pengambilan Barang Gudang)** 

#### **Tujuan:** 

Pencatatan pengeluaran persediaan barang untuk dipakai sendiri oleh unit/divisi perusahaan (bukan untuk dijual). 

#### **Fitur Utama:** 

- **Import dari FPB:** Menarik barang dari FPB berstatus Approved yang tidak membutuhkan pembelian luar. 

- Verifikasi kuantitas fisik yang diserahkan petugas gudang. 

- **Update Stok:** Mengurangi jumlah stok gudang dan mencatat pembebanan biaya operasional internal. 

## **BAB 4: MODUL SALES** 

Modul Sales mengelola alur penjualan ritel (Point of Sale) maupun transaksi berlangganan/B2B dengan pola tagihan harian yang di-faktur-kan pada akhir bulan. 

### **4.1 POS Sales (Point of Sale)** 

#### **Tujuan:** 

Mengakomodasi penjualan langsung di kasir toko dengan pemrosesan transaksi yang cepat. 

#### **Fitur Utama:** 

- Pencarian cepat dan pencatatan keranjang belanja real-time. 

- **Opsi Pembayaran Fleksibel:** 

   - **Tombol CASH:** Pelunasan langsung secara instan via Tunai, QRIS, atau Kartu (EDC). 

   - **Tombol PIUTANG:** Mengarahkan transaksi penjualan ke akun Piutang Pelanggan (Accounts Receivable) tanpa pembayaran tunai langsung di tempat. 

- Pembaruan stok terpotong seketika saat cetak struk/nota. 

### **4.2 Sales Order - Delivery Order (SO - DO / M_InOut)** 

#### **Tujuan:** 

Mengakomodasi skenario khusus di mana pelanggan mengambil barang ke toko setiap hari, dan penagihan dilakukan secara kolektif di akhir bulan. 

#### **Fitur Utama:** 

- **Otomasi Dokumen Dual:** Saat transaksi penyerahan barang harian di-input, sistem secara otomatis meng-generasi dokumen Sales Order sekaligus Shipment / Delivery Order (M_InOut). 

- Stok barang langsung terpotong saat penyerahan harian terjadi. 

- Setiap riwayat pengiriman tercatat sebagai draf serah-terima (Delivery Order) yang valid untuk ditagihkan nanti. 

### **4.3 Sales Invoice (Faktur Penjualan)** 

#### **Tujuan:** 

Penerbitan dokumen penagihan resmi (Invoice) kepada pelanggan. 

#### **Fitur Utama:** 

- **Import dari M_InOut (DO):** Menarik dan mengonsolidasikan seluruh dokumen pengiriman (Delivery Order) harian milik pelanggan dalam 1 bulan menjadi 1 Faktur Tagihan Bulanan. 

- **Manual Invoice:** Penerbitan faktur tagihan langsung secara manual tanpa alur pengiriman barang. 

- Pencatatan nilai piutang resmi di sistem keuangan beserta penetapan tanggal jatuh tempo. 

## **BAB 5: MODUL BANK STATEMENT & CASH RECONCILIATION** 

Modul ini berfungsi untuk menjaga akurasi keuangan dan memastikan ketersediaan dana tercatat sesuai dengan realita lapangan. 

### **5.1 Rekonsiliasi Kas Register & Rekening Bank** 

#### **Tujuan:** 

Mencocokkan saldo fisik kasir (Cash Register) atau mutasi rekening bank dengan pencatatan pembukuan internal. 

#### **Fitur Utama:** 

- Komparasi nilai saldo sistem vs saldo riil. 

- Penandaan transaksi yang terverifikasi (cleared/matched). 

### **5.2 Import Bank Statement** 

#### **Tujuan:** 

Mengunggah file mutasi rekening dari bank (format CSV/Excel) untuk melakukan pencocokan (matching) transaksi penerimaan dan pengeluaran secara masal. 

### **5.3 Pembuatan Charge Manual (Biaya Operasional Langsung)** 

#### **Tujuan:** 

Mencatat transaksi pengeluaran kas/bank yang bersifat langsung tanpa melalui dokumen Purchase Order terlebih dahulu. 

#### **Contoh Kasus:** 

Pembayaran biaya kebersihan, iuran keamanan, biaya admin bank, atau pembelian perlengkapan kecil. 

#### **Dampak Akuntansi:** 

- Pencatatan Charge Manual secara otomatis mengurangi saldo Kas/Bank yang dipilih. 

- Secara bersamaan menambah akun Beban/Biaya (Charge Account) pada laporan keuangan. 

## **BAB 6: INTEGRASI WORKFLOW APPROVAL & SECURITY** 

#### **Persetujuan Terpusat (Workflow Engine iDempiere):** 

- Proses Approval tidak dipindahkan ke aplikasi React frontend, melainkan dieksekusi oleh mesin Workflow resmi bawaan iDempiere. 

- Aplikasi React bertugas mengirimkan status dokumen (Draft → Complete). 

#### **Visibilitas Status:** 

- Pengguna aplikasi React dapat melihat riwayat dan tahap persetujuan terkini (approval stepper) pada dokumen. 

#### **Audit Trail:** 

- Seluruh jejak persetujuan terekam pada tabel audit iDempiere (AD_WF_EventAudit) guna memenuhi standar pemeriksaan audit. 

## **BAB 7: CETAK & VERIFIKASI DOKUMEN VIA QR CODE** 

- **Template JasperReports:** Setiap dokumen transaksi resmi (FPB, PO, Goods Receipt, Internal Use, Invoice) dilengkapi dengan QR Code unik. 

- **Keamanan HMAC-SHA256:** QR Code memuat token enkripsi aman yang dipasangkan dengan UUID dokumen. 

- **Verifikasi Publik:** Pindaian QR Code melalui kamera ponsel akan mengarahkan pengguna ke endpoint verifikasi publik untuk menampilkan keaslian dokumen, status terkini, dan riwayat approval secara real-time tanpa perlu login ke sistem. 

## **MATRIKS RANGKUMAN FITUR APLIKASI** 

|**Fitur / Fasilitas**|**Requisition**|**Purchasing**|**Goods**<br>**Receipt**|**Internal Use**|**POS Sales**|**Sales Order -**<br>**DO**|**Sales Invoice**|**Bank**<br>**Statement**|
|---|---|---|---|---|---|---|---|---|
|**Scan QR / Barcode**|—|—|**Ya**|**Ya**|**Ya**|—|—|—|
|**Import Dokumen Acuan**|—|dari FPB|dari PO|dari FPB|—|—|dari DO<br>(M_InOut)|Import<br>CSV/Bank|
|**Otomasi Potong/Tambah**<br>**Stok**|—|—|(+ Tambah)|(- Kurang)|(- Kurang)|(- Kurang)|—|—|
|**Cetak PDF + QR Code**|**Ya**|**Ya**|**Ya**|**Ya**|Struk|**Ya**|**Ya**|**Ya**|
|**Opsi Piutang / Cash**|—|—|—|—|**Ya**|—|**Ya**|—|
|**Charge Manual (Beban Kas)**|—|—|—|—|—|—|—|**Ya**|





