import React, { useState, useEffect, useCallback } from 'react';
import { Link } from "react-router-dom";
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { idempiereApi } from '../utils/idempiereApi'; // sesuaikan path
import '../App.css';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = useState(0);

  const columns = [
    { key: 'Value', label: 'Search Key' },
    { key: 'Name', label: 'Partner Name' },
    { key: 'UPC', label: 'UPC/EAN' },
  ];

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const fields = 'Name,Value,Description,IsPurchased,IsSold,UPC';

      let url = `/models/m_product?$select=${fields}&$top=${pageSize}&$skip=${offset}`;
      if (search) {
        url += `&$filter=contains(tolower(Name),'${search.toLowerCase()}')`;
      }

      const data = await idempiereApi(url);
      setProducts(data.records || []);
      setTotalRecords(data['row-count'] ?? 0);
    } catch (err) {
      console.error("Fetch Error:", err.message);
      setProducts([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const actionRenderer = (item) => {
    const isEditDisabled = item.IsActive === 'N';

    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Tombol View selalu aktif */}
        <Link to={`/product/view/${item.id}`}>
          <button className="btn-action-view">View</button>
        </Link>
        
        {/* Kondisi Tombol Edit diatur penuh di sini */}
        <Link 
          to={isEditDisabled ? '#' : `/product/edit/${item.id}`}
          style={{ pointerEvents: isEditDisabled ? 'none' : 'auto' }}
        >
          <button 
            disabled={isEditDisabled} 
            className="btn-action-edit"
            style={{
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              opacity: isEditDisabled ? 0.5 : 1,
              cursor: isEditDisabled ? 'not-allowed' : 'pointer',
              backgroundColor: isEditDisabled ? '#6c757d' : '#e0a800'
            }}
          >
            Edit
          </button>
        </Link>
      </div>
    );
  };
  return (
    <div className="card-container">
      {/* 1. Pakai PageHeader */}
      <PageHeader 
        title="Product / Service" 
        onSearch={(val) => { setSearch(val); setOffset(0); }} 
      />

      {/* 2. Pakai DataTable */}
      <DataTable 
        columns={columns}
        data={products}
        loading={loading}
        offset={offset}
        pageSize={pageSize}
        totalRecords={totalRecords} // Kirim total record ke komponen
        onPageChange={(newOffset) => setOffset(newOffset)} // Mengatur perpindahan halaman secara dinamis
        renderActions={actionRenderer}
      />
    </div>
  );
}

export default ProductList;
