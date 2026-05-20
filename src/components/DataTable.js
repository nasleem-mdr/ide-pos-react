import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Components.css';

// Komponen Icon Navigasi Internal
const FirstIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
);
const PrevIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
);
const NextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
);
const LastIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 5 22 12 13 19 13 5"></polygon><polygon points="2 5 11 12 2 19 2 5"></polygon></svg>
);

export default function DataTable({ 
  columns, 
  data, 
  loading, 
  offset, 
  pageSize, 
  totalRecords = 0, 
  onPageChange,     
  renderActions // Prop baru berupa fungsi untuk merender tombol aksi khusus
}) {
  if (loading) return <div className="loading-state">Loading data iDempiere...</div>;

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  
  return (
    <div className="table-card">
      <table className="modern-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col.key}>{col.label}</th>)}
            <th>Actions</th> {/* Kolom action tetap ada secara default */}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.key === 'Value' ? <strong>{item[col.key]}</strong> : item[col.key] || '-'}
                </td>
              ))}
              <td>
                {/* Menjalankan fungsi renderActions yang dikirim dari Pages */}
                {renderActions ? renderActions(item) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Format Navigasi Baru: <| <  1 / 10 > |> */}
      <div className="pagination-container" style={paginationWrapperStyle}>
        
        {/* First Page <| */}
        <button 
          disabled={currentPage === 1} 
          onClick={() => onPageChange(0)} 
          className="btn-pagination-icon"
          title="Halaman Pertama"
        >
          <FirstIcon />
        </button>

        {/* Previous Page < */}
        <button 
          disabled={currentPage === 1} 
          onClick={() => onPageChange(offset - pageSize)} 
          className="btn-pagination-icon"
          title="Halaman Sebelumnya"
        >
          <PrevIcon />
        </button>

        {/* Status Halaman: 1 / 10 */}
        <span className="pagination-info" style={{ margin: '0 10px', fontWeight: '600' }}>
          {currentPage} / {totalPages}
        </span>

        {/* Next Page > */}
        <button 
          disabled={currentPage >= totalPages || data.length < pageSize} 
          onClick={() => onPageChange(offset + pageSize)} 
          className="btn-pagination-icon"
          title="Halaman Selanjutnya"
        >
          <NextIcon />
        </button>

        {/* Last Page |> */}
        <button 
          disabled={currentPage >= totalPages || data.length < pageSize} 
          onClick={() => onPageChange((totalPages - 1) * pageSize)} 
          className="btn-pagination-icon"
          title="Halaman Terakhir"
        >
          <LastIcon />
        </button>

      </div>
    </div>
  );
}

// Inline style tambahan untuk merapikan tombol icon bulat/kotak kecil
const paginationWrapperStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '6px',
  padding: '16px',
  background: '#ffffff'
};
