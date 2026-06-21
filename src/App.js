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
import { AccessProvider } from './context/AccessContext';
import ProtectedRoute from './components/ProtectedRoute';


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
    <AccessProvider>
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
                <Route path="/business-partner" element={
                    <ProtectedRoute windowKey="businessPartner">
                      <BusinessPartner />
                    </ProtectedRoute>
                } />
                <Route path="/business-partner/:id/edit" element={
                  <ProtectedRoute windowKey="businessPartnerEdit">
                    <BusinessPartnerEdit />
                  </ProtectedRoute>
                } />
                <Route path="/business-partner/:id" element={
                  <ProtectedRoute windowKey="businessPartner">
                    <BusinessPartnerDetail />
                  </ProtectedRoute>
                } />

                <Route path="/pos-order" element={
                  <ProtectedRoute windowKey="pos">
                    <POSContainer />
                  </ProtectedRoute>
                } />
      
                <Route path="/sales-order" element={
                  <ProtectedRoute windowKey="salesOrder">
                    <SalesOrderPage />
                  </ProtectedRoute>
                } />
      
                <Route path="/requisition" element={
                  <ProtectedRoute windowKey="requisition">
                    <RequisitionContainer />
                  </ProtectedRoute>
                } />
              </Routes>
            </main>
          </div>
        </div>
      )}
      </AccessProvider>
    </BrowserRouter>
  );
}
