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
import RequisitionList from "./pages/RequisitionList";
import GoodsReceiptList from "./pages/GoodsReceiptList";
import PurchasingList from "./pages/PurchasingList";
import RequisitionView from "./pages/RequisitionView";
import PurchasingView from "./pages/PurchasingView";
import ProductList from "./pages/ProductList";
import GoodsReceiptContainer from './pages/GoodsReceiptContainer';
import PurchasingContainer from './pages/PurchasingContainer';
import InternalUseContainer from './pages/InternalUseContainer';
import './css/AppLayout.css'; // Pastikan mengimpor file CSS layout Anda

export default function App() {
  const [session, setSession] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  function handleLoginSuccess(sessionInfo) {
    setSession(sessionInfo);
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem("token");
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* ===== ROUTE PUBLIK - di luar kondisi session apapun ===== */}
        <Route path="/view/requisition/:uuid" element={<RequisitionView />} />
        <Route path="/view/order/:uuid" element={<PurchasingView />} />
        {/* nanti tambah di sini: */}
        {/* <Route path="/view/booking" element={<BookingView />} /> */}

        {/* ===== ROUTE YANG BUTUH SESSION ===== */}
        <Route
          path="*"
          element={
            !session ? (
              // Belum login - tampilkan auth
              <Routes>
                <Route path="/" element={<IDempiereAuth onLoginSuccess={handleLoginSuccess} />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            ) : (
              // Sudah login - tampilkan app
              <AccessProvider>
                <div className={`app-layout ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
                  <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
                  <div className="main-wrapper">
                   <Header
                      session={session}
                      onLogout={handleLogout}
                      onSessionUpdate={(updated) => setSession((prev) => ({ ...prev, ...updated }))}
                    />
          
                    <main className="content">
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
                        <Route path="/product" element={
                          <ProtectedRoute windowKey="product">
                            <ProductList />
                          </ProtectedRoute>
                        } />
                        <Route path="/requisition-list" element={<RequisitionList />} />
                        <Route path="/goodsreceipt-list" element={<GoodsReceiptList />} />
                        <Route path="/requisition" element={<RequisitionContainer />} />
                        <Route path="/goods-receipt" element={
                          <ProtectedRoute windowKey="goodsReceipt">
                            <GoodsReceiptContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/purchasing" element={
                          <ProtectedRoute windowKey="purchasing">
                            <PurchasingContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/purchasing-list" element={<PurchasingList />} />
                          <Route path="/internal-use" element={
                          <ProtectedRoute windowKey="internalUse">
                            <InternalUseContainer />
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </main>
                  </div>
                </div>
              </AccessProvider>
            )
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
