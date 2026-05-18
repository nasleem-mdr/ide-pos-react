import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import '../App.css';

function BusinessPartner() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0); 
  const pageSize = 10;
  const [totalRecords, setTotalRecords] = useState(0);
  // Konfigurasi Kolom untuk Tabel
  const columns = [
    { key: 'Value', label: 'Search Key' },
    { key: 'Name', label: 'Partner Name' },
    { key: 'TaxID', label: 'Tax ID' }
  ];

  const fetchBP = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;

    setLoading(true);
    try {
      let url = `/api/v1/models/c_bpartner?$top=${pageSize}&$skip=${offset}`;
      if (search) {
        url += `&$filter=contains(tolower(Name),'${search.toLowerCase()}')`;
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      });

      if (response.status === 401) throw new Error("Unauthorized");
      const data = await response.json();
      setPartners(data.records || []);
      setTotalRecords(data['row-count'] || data.totalRecords || 100);
    } catch (err) {
      console.error("Fetch Error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [offset, search]);

  useEffect(() => {
    fetchBP();
  }, [fetchBP]);

  return (
    <div className="card-container">
      {/* 1. Pakai PageHeader */}
      <PageHeader 
        title="Business Partner Management" 
        onSearch={(val) => { setSearch(val); setOffset(0); }} 
      />

      {/* 2. Pakai DataTable */}
      <DataTable 
        columns={columns}
        data={partners}
        loading={loading}
        offset={offset}
        pageSize={pageSize}
        totalRecords={totalRecords} // Kirim total record ke komponen
        onPageChange={(newOffset) => setOffset(newOffset)} // Mengatur perpindahan halaman secara dinamis
        detailPathPrefix="/bp"
      />
    </div>
  );
}

export default BusinessPartner;
