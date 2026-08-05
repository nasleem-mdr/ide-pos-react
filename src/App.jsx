import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"; 

//purchasing
import { 
  PurchasingContainer, 
  PurchasingList, 
  PurchasingView 
} from "@/features/purchasing/order/pages";

import { VendorInvoiceContainer } from '@/features/purchasing/invoice/pages';

// Material Management
import RequisitionContainer from '@/features/requisition/pages/RequisitionContainer';
import RequisitionView from "@/features/requisition/pages/RequisitionView";
import RequisitionList from "@/features/requisition/pages/RequisitionList";
import GoodsReceiptContainer from '@/features/material/receipt/pages/GoodsReceiptContainer';
import GoodsReceiptList from "@/features/material/receipt/pages/GoodsReceiptList";
import InternalUseContainer from '@/features/material/internaluse/pages/InternalUseContainer';
import InternalUseList from "@/features/material/internaluse/pages/InternalUseList";
import ProductList from "@/features/master/product/pages/ProductList";
import ProductDetail from "@/features/master/product/pages/ProductDetail";

// Sales Management
import SalesOrderPage from "@/features/sales/order/pages/SalesOrderPage";
import POSContainer from "@/features/sales/order/pages/POSContainer"; 

import BookingTimeline from '@/features/login/pages/BookingTimeline';

// Partner management
import BusinessPartner from "@/features/master/partner/pages/BusinessPartner"; 
import BusinessPartnerDetail from "@/features/master/partner/pages/BusinessPartnerDetail";
import BusinessPartnerEdit from '@/features/master/partner/pages/BusinessPartnerEdit';
import { AccessProvider } from '@/context/AccessContext';

// Banking
import BankStatementContainer from '@/features/banking/statement/pages/BankStatementContainer';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import IDempiereAuth from "@/features/login/pages/IDempiereAuth";
import Dashboard from "@/features/login/pages/Dashboard";
import { Header, Sidebar } from "@/shared/components/setup"; 

import '@/css/AppLayout.css'; // Pastikan mengimpor file CSS layout Anda

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const [session, setSession] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  function handleLoginSuccess(sessionInfo) {
    setSession(sessionInfo);
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem("token");
  }
  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('token');
      setSession(null); // opsional tapi disarankan — reset state session juga, bukan cuma token
      navigate('/', { replace: true });
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [navigate]);

  return (
    
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
                        <Route path="/booking" element={<BookingTimeline session={session} resourceTypeId={1000000} docTypeTargetId={1000210}/> } />
                         {/* ===== Master ===== */}
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
                                                
                        <Route path="/product" element={
                          <ProtectedRoute windowKey="product">
                            <ProductList />
                          </ProtectedRoute>
                        } />
                        <Route path="/product-detail" element={
                          <ProtectedRoute windowKey="productDetail">
                            <ProductDetail />
                          </ProtectedRoute>
                        } />
                        {/* ===== Transaksi ===== */}
                        <Route path="/sales-order" element={
                          <ProtectedRoute windowKey="salesOrder">
                            <SalesOrderPage />
                          </ProtectedRoute>
                        } />
                        <Route path="/pos-order" element={
                          <ProtectedRoute windowKey="pos">
                            <POSContainer />
                          </ProtectedRoute>
                        } />                        
                        <Route path="/requisition" element={
                          <ProtectedRoute windowKey="requisition">
                            <RequisitionContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/purchasing" element={
                          <ProtectedRoute windowKey="purchasing">
                            <PurchasingContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/goods-receipt" element={
                          <ProtectedRoute windowKey="goodsReceipt">
                            <GoodsReceiptContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/internal-use" element={
                          <ProtectedRoute windowKey="internalUse">
                            <InternalUseContainer />
                          </ProtectedRoute>
                        } />
                        {/* ===== List atau report ===== */}
                        <Route path="/requisition-list" element={
                          <ProtectedRoute windowKey="requisitionList">
                            <RequisitionList />
                          </ProtectedRoute>
                        } />
                        <Route path="/purchasing-list" element={
                          <ProtectedRoute windowKey="purchasingList">
                            <PurchasingList />
                          </ProtectedRoute>
                        } />
                        <Route path="/goodsreceipt-list" element={
                          <ProtectedRoute windowKey="goodsReceiptList">
                            <GoodsReceiptList />
                          </ProtectedRoute>
                        } />
                        <Route path="/internaluse-list" element={
                          <ProtectedRoute windowKey="internalUseList">
                            <InternalUseList />
                          </ProtectedRoute>
                        } />
                      
                        <Route path="/vendor-invoice" element={
                          <ProtectedRoute windowKey="vendorInvoice">
                            <VendorInvoiceContainer />
                          </ProtectedRoute>
                        } />
                        <Route path="/bank-statement" element={
                          <ProtectedRoute windowKey="bankstatement">
                            <BankStatementContainer />
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
    
  );
}
