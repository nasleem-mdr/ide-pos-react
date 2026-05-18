import '../css/Components.css';

export default function PageHeader({ title, onSearch }) {
  return (
    /* Ganti ke page-header-container agar posisi flexbox aktif */
    <div className="page-header-container">
      {/* Tambahkan class pada h2 jika ingin style teksnya ikut berubah */}
      <h2 className="page-header-title">{title}</h2>
      
      {/* Ganti ke page-header-search untuk efek bayangan dan dimensi */}
      <input 
        type="text" 
        placeholder={`Cari ${title}...`} 
        onChange={(e) => onSearch(e.target.value)}
        className="page-header-search"
      />
    </div>
  );
}
