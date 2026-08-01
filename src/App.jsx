import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; 

import RequisitionContainer from './features/requisition/pages/RequisitionContainer';
import RequisitionView from "@/features/requisition/pages/RequisitionView";
import RequisitionList from "@/features/requisition/pages/RequisitionList";

//purchasing
import { PurchasingContainer, PurchasingList, PurchasingView } from "./features/purchasing/order/pages";
import { VendorInvoiceContainer } from '@/features/purchasing/invoice/pages';

import GoodsReceiptContainer from '@/features/material/receipt/pages/GoodsReceiptContainer';
import GoodsReceiptList from "@/features/material/receipt/pages/GoodsReceiptList";

import InternalUseContainer from '@/features/internal/pages/InternalUseContainer';
import InternalUseList from "@/features/internal/pages/InternalUseList";

import SalesOrderPage from "@/features/sales/order/pages/SalesOrderPage";
import POSContainer from "@/features/sales/order/pages/POSContainer"; 

import BookingTimeline from './pages/BookingTimeline';
import ProductList from "./pages/ProductList";
import BusinessPartner from "./pages/BusinessPartner"; 
import BusinessPartnerDetail from "./pages/BusinessPartnerDetail";
import BusinessPartnerEdit from './pages/BusinessPartnerEdit';
import { AccessProvider } from './context/AccessContext';
import ProtectedRoute from './components/ProtectedRoute';
import IDempiereAuth from "./pages/IDempiereAuth";
import Dashboard from "./pages/Dashboard";
import Header from "./components/Header"; 
import Sidebar from "./components/Sidebar";

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
