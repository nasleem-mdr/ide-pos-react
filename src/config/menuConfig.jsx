import { HomeIcon, ImportIcon, BankIcon, VendorIcon, RequisitionIcon, ShoppingCartIcon, DeliveryIcon, UserTake, ListIcon, PartnerIcon, BoxIcon, CashierIcon, } from '@/shared/components/icon';
import { ShoppingBagIcon } from '@/shared/components/icon/ShoppingBagIcon';

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
            { key: 'bankstatement',   windowKey: 'bankstatement',  path: '/bank-statement',  label: 'Bank/Cash Statement',  icon: <BankIcon /> },
            { key: 'booking',       windowKey: 'booking', path: '/booking',         label: 'Booking Timeline',  icon: <UserTake /> },
            ]
    },
    {
        sectionKey: 'reportpro',
        sectionLabel: 'Procurement Report',
        defaultCollapsed: true,
            items: [
            { key: 'requisition-list', windowKey: 'requisitionList', borderTop: true, path: '/requisition-list',  label: 'Requisition List',    icon: <ListIcon teks={'R'} /> },
            { key: 'purchasing-list',  windowKey: 'purchasingList',  path: '/purchasing-list',   label: 'Purchasing List',     icon: <ListIcon teks={'P'} /> },
            { key: 'goodsreceipt-list', windowKey: 'goodsReceiptList', path: '/goodsreceipt-list', label: 'Goods Receipt List', icon: <ListIcon teks={'G'} /> },
            { key: 'internaluse-list', windowKey: 'internalUseList',  path: '/internaluse-list',  label: 'Internal Use List',   icon: <ListIcon teks={'IU'} /> },
            { key: 'vendorInvoiceList', windowKey: 'vendorInvoiceList',  path: '/vendorinvoice-list',  label: 'Vendor Invoice List',   icon: <ListIcon teks={'VI'} /> },
        ]
    },
    {
        sectionKey: 'reportsales',
        sectionLabel: 'Sales Report',
        defaultCollapsed: true,
            items: [
            { key: 'posOrderList', windowKey: 'posOrderList',  path: '/posorder-list',  label: 'POS Order List',   icon: <ListIcon teks={'PS'} /> },
            { key: 'salesInvoiceList', windowKey: 'salesInvoiceList',  path: '/salesinvoice-list',  label: 'Sales Invoice List',   icon: <ListIcon teks={'SI'} /> },
        ]
    },
    {
        sectionKey: 'master',
        sectionLabel: 'Master',
        defaultCollapsed: true,
        items: [
            { key: 'businessPartner', windowKey: 'businessPartner', path: '/business-partner', label: 'Business Partner', icon: <PartnerIcon /> },
            { key: 'product',         windowKey: 'product',         path: '/product',          label: 'Products',        icon: <BoxIcon /> },
        ]
    }
];

export function getMenuSections(sectionKeys) {
    if (!sectionKeys) return menuSections; 
    return menuSections.filter(s => sectionKeys.includes(s.sectionKey));
}
