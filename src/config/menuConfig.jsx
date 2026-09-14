import { HomeIcon, ImportIcon, BankIcon, VendorIcon, RequisitionIcon, ShoppingCartIcon, DeliveryIcon, UserTake, ListIcon, PartnerIcon, BoxIcon, CashierIcon, } from '@/shared/components/icon';
import { ShoppingBagIcon } from '@/shared/components/icon/ShoppingBagIcon';
import { MdOutlinePayments, MdOutlineStore } from "react-icons/md";
import { SiGoogleanalytics } from "react-icons/si";
import { PiCashRegister, PiGitPullRequestBold, PiPresentationChart } from "react-icons/pi";
import { LiaFileInvoiceDollarSolid, LiaPeopleCarrySolid } from "react-icons/lia";
import { BiPurchaseTagAlt } from "react-icons/bi";
import { TbCreditCardHand } from "react-icons/tb";

export const menuSections = [ 
    {
        sectionKey: 'procurement',
        sectionLabel: 'Procurement',
        defaultCollapsed: true,
        items: [
            { key: 'dashboard',     windowKey: 'dashboard',    path: '/dashboard',      label: 'Dashboard',     icon: <HomeIcon /> },
            { key: 'requisition',   windowKey: 'requisition',  path: '/requisition',    label: 'Requisition',   icon: <RequisitionIcon /> },
            { key: 'purchasing',    windowKey: 'purchasing',   path: '/purchasing',     label: 'Purchasing',    icon: <ShoppingCartIcon /> },
            { key: 'goodsReceipt',  windowKey: 'goodsReceipt', path: '/goods-receipt', label: 'Goods Receipt', icon: <DeliveryIcon /> },
            { key: 'internalUse',   windowKey: 'internalUse',  path: '/internal-use',  label: 'Internal Use',  icon: <UserTake /> },
            { key: 'vendorInvoice',   windowKey: 'vendorInvoice',  path: '/vendor-invoice',  label: 'Vendor Invoice',  icon: <VendorIcon /> },
        ]
    },
    {
        sectionKey: 'sales',
        sectionLabel: 'Sales',
        defaultCollapsed: true,
        items: [
            { key: 'pos-order',     windowKey: 'pos',    path: '/pos-order',        label: 'Pos Sales',     icon: <CashierIcon size={20}/> },
            { key: 'salesOrder',     windowKey: 'salesOrder',    path: '/sales-order',        label: 'Sales Order',     icon: <ShoppingBagIcon size={24}/> },
            { key: 'salesInvoice',       windowKey: 'salesInvoice', path: '/sales-invoice',         label: 'Sales Invoice',  icon: <ImportIcon size={20}/> },
            ]
    },
    {
        sectionKey: 'payment',
        sectionLabel: 'Payment/Receipt',
        defaultCollapsed: true,
        items: [
            { key: 'paymentReceipt',   windowKey: 'paymentReceipt',  path: '/payment-receipt',  label: 'Payment and Receipt',  icon: <MdOutlinePayments size={24} /> },
            { key: 'bankstatement',   windowKey: 'bankstatement',  path: '/bank-statement',  label: 'Bank/Cash Statement',  icon: <BankIcon /> },
            { key: 'booking',       windowKey: 'booking', path: '/booking',         label: 'Booking Timeline',  icon: <UserTake /> },
            ]
    },
    {
        sectionKey: 'reportpro',
        sectionLabel: 'Procurement Report',
        defaultCollapsed: true,
            items: [
            { key: 'requisition-list', windowKey: 'requisitionList', borderTop: true, path: '/requisition-list',  label: 'Requisition List',    icon: <PiGitPullRequestBold /> },
            { key: 'purchasing-list',  windowKey: 'purchasingList',  path: '/purchasing-list',   label: 'Purchasing List',     icon: <BiPurchaseTagAlt /> },
            { key: 'goodsreceipt-list', windowKey: 'goodsReceiptList', path: '/goodsreceipt-list', label: 'Goods Receipt List', icon: <LiaPeopleCarrySolid /> },
            { key: 'internaluse-list', windowKey: 'internalUseList',  path: '/internaluse-list',  label: 'Internal Use List',   icon: <TbCreditCardHand /> },
            { key: 'vendorInvoiceList', windowKey: 'vendorInvoiceList',  path: '/vendorinvoice-list',  label: 'Vendor Invoice List',   icon: <MdOutlineStore /> },      
        ]
    },
    {
        sectionKey: 'reportsales',
        sectionLabel: 'Sales Report',
        defaultCollapsed: true,
            items: [
            { key: 'posOrderList', windowKey: 'posOrderList',  path: '/posorder-list',  label: 'POS Order List',   icon: <PiCashRegister /> },
            { key: 'salesInvoiceList', windowKey: 'salesInvoiceList',  path: '/salesinvoice-list',  label: 'Sales Invoice List',   icon: <LiaFileInvoiceDollarSolid /> },
        ]
    },
    {
        sectionKey: 'linkreport',
        sectionLabel: 'All Report',
        defaultCollapsed: true,
            items: [
            { key: 'dashboardMenu', windowKey: 'dashboardMenu',  path: '/dashboard-menu',  label: 'Report Dashboard',   icon: <SiGoogleanalytics size={24} /> },
        ]
    },
    {
        sectionKey: 'financialreport',
        sectionLabel: 'Financial Report',
        defaultCollapsed: true,
            items: [
            { key: 'financialReport', windowKey: 'financialReport',  path: '/financial-report',  label: 'Financial Report',   icon: <PiPresentationChart /> },
        ]
    },
    {
        sectionKey: 'master',
        sectionLabel: 'Master',
        defaultCollapsed: true,
        items: [
            { key: 'businessPartner', windowKey: 'businessPartner', path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
            { key: 'product',         windowKey: 'product',         path: '/product',          label: 'Products',        icon: <BoxIcon /> },
            { key: 'productDetail',         windowKey: 'productDetail',         path: '/product-detail/new',          label: 'New Products',        icon: <BoxIcon /> },
        ]
    }
];

export function getMenuSections(sectionKeys) {
    if (!sectionKeys) return menuSections; 
    return menuSections.filter(s => sectionKeys.includes(s.sectionKey));
}
