// src/pages/BusinessPartnerDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function BusinessPartnerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bp, setBp] = useState(null);
  const [locations, setLocations] = useState([]); // State untuk Alamat (Tab Alamat)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Accept': 'application/json'
        };

        // 1. Ambil Data Utama BP
        const resBP = await fetch(`/api/v1/models/c_bpartner/${id}`, { headers });
        const dataBP = await resBP.json();
        setBp(dataBP);

        // 2. Ambil Data Alamat (Relasi ke C_BPartner_Location)
        // Kita gunakan filter berdasarkan C_BPartner_ID
        const resLoc = await fetch(`/api/v1/models/c_bpartner_location?$filter=C_BPartner_ID eq ${id}&$expand=C_Location_ID,M_PriceList_ID,C_PaymentTerm_ID`,  { headers });
        const dataLoc = await resLoc.json();
        setLocations(dataLoc.records || []);

      } catch (err) {
        console.error("Error fetching detail:", err);
      }
    };
    fetchData();
  }, [id]);

  if (!bp) return <div className="card-container">Loading detail...</div>;

  return (
    <div className="card-container">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
         <button onClick={() => navigate(-1)} className="btn-back">← Back to List</button>
         <button onClick={() => navigate(`/bp/${id}/edit`)}>✏ Edit</button>
         <span style={{color: '#777'}}>BP ID: {id}</span>
      </div>

      <div className="detail-grid">
        {/* SECTION 1: INFORMASI UTAMA */}
        <div className="detail-section">
          <h3>General Information</h3>
          <div className="info-group">
            <label>Search Key</label> <p>{bp.Value}</p>
            <label>Name</label> <p>{bp.Name}</p>
            <label>Tax ID</label> <p>{bp.TaxID || '-'}</p>
            <label>Description</label> <p>{bp.Description || '-'}</p>
          </div>
        </div>

        {/* SECTION 2: STATUS & GRUP */}
        <div className="detail-section">
          <h3>Classification</h3>
          <div className="info-group">
            <label>BP Group</label> <p>{bp.C_BP_Group_ID_Identifier}</p>
            <label>Vendor</label> <p>{bp.IsVendor ? 'Yes' : 'No'}</p>
            <label>Customer</label> <p>{bp.IsCustomer ? 'Yes' : 'No'}</p>
            <label>Employee</label> <p>{bp.IsEmployee ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <div className="detail-section">
          <h3>Customer Information</h3>
          <div className="info-group">
            <label>Term Payment</label> <p>{bp.M_PrinceList_ID_Identifier}</p>
            <label>Vendor</label> <p>{bp.IsVendor ? 'Yes' : 'No'}</p>
            <label>Customer</label> <p>{bp.IsCustomer ? 'Yes' : 'No'}</p>
            <label>Employee</label> <p>{bp.IsEmployee ? 'Yes' : 'No'}</p>
          </div>
        </div>
        {/* Section tambahan di dalam detail-grid */}
        <div className="detail-section">
        <h3>Financials</h3>
        <div className="info-group">
            {/* Menggunakan Identifier untuk nama yang ramah pengguna */}
            <label>Price List</label> 
            <p>{bp.M_PriceList_ID_Identifier || 'Not Set'}</p>
            
            <label>Payment Term</label> 
            <p>{bp.C_PaymentTerm_ID_Identifier || 'Not Set'}</p>
            
            {/* Jika menggunakan $expand, kamu bisa akses properti spesifik lainnya */}
            {bp.C_PaymentTerm_ID && (
            <small style={{ color: '#888' }}>
                Net Days: {bp.C_PaymentTerm_ID.NetDays}
            </small>
            )}
        </div>
        </div>

        {/* SECTION 3: ALAMAT (TAB LOCATION) */}
        <div className="detail-section" style={{ gridColumn: '1 / -1' }}>
          <h3>Addresses / Locations</h3>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Name/Phone</th>
                <th>Address</th>
                <th>Bill To</th>
                <th>Ship To</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id}>
                  <td>{loc.Name}<br/><small>{loc.Phone}</small></td>
                  <td>
        {/* Menggunakan Identifier yang biasanya berisi string alamat lengkap */}
        <div>{loc.C_Location_ID_Identifier}</div>
        
        {/* Jika ingin rincian manual (asumsi data ter-expand atau tersedia field Address1, dst) */}
        {loc.C_Location_ID && (
          <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
            {loc.C_Location_ID.Address1}<br/>
            {loc.C_Location_ID.Address2 && <>{loc.C_Location_ID.Address2}<br/></>}
            {loc.C_Location_ID.City}, {loc.C_Location_ID.Postal}
          </div>
        )}
      </td>
                  <td>{loc.IsBillTo ? '✅' : '-'}</td>
                  <td>{loc.IsShipTo ? '✅' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default BusinessPartnerDetail;
