import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; 
import IDempiereAuth from "./pages/IDempiereAuth";
import Dashboard from "./pages/Dashboard";
import BusinessPartner from "./pages/BusinessPartner"; 
import BusinessPartnerDetail from "./pages/BusinessPartnerDetail"; 
import POSContainer from "./pages/POSContainer"; 
import Header from "./components/Header"; 
import Sidebar from "./components/Sidebar";
import BusinessPartnerEdit from './pages/BusinessPartnerEdit';
import SalesOrderPage from "./pages/SalesOrderPage";
import RequisitionContainer from './pages/RequisitionContainer';

import './css/AppLayout.css'; // Pastikan mengimpor file CSS layout Anda

export default function App() {
  const [session, setSession] = useState(null);
  // 1. Tambahkan state collapse di sini
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  function handleLoginSuccess(sessionInfo) {
    setSession(sessionInfo);
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem('token'); 
  }

  return (
    <BrowserRouter>
      {!session ? (
        <Routes>
          <Route path="/" element={<IDempiereAuth onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        /* 2. Tambahkan class dinamis 'sidebar-collapsed' pada pembungkus utama */
        <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* 3. Kirim state dan setter ke Sidebar sebagai props */}
          <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
          
          <div className="main-wrapper">
            <Header session={session} onLogout={handleLogout} />
            
            <main className="content">
              <Routes>
                <Route path="/dashboard" element={<Dashboard session={session} />} />
                <Route path="/business-partner" element={<BusinessPartner />} />
                <Route path="/pos-order" element={<POSContainer />} />
                <Route path="/bp/:id" element={<BusinessPartnerDetail />} />
                <Route path="/bp/:id/edit" element={<BusinessPartnerEdit />} />
                <Route path="/sales-orders" element={<SalesOrderPage />} />
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/requisition" element={<RequisitionContainer />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}
