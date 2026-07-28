import { HomeIcon, RequisitionIcon, ShoppingCartIcon, DeliveryIcon, UserTake, ListIconR, ListIconP, ListIconG, ListIconA, PartnerIcon, BoxIcon, CashierIcon, } from '../components/Icons'; // sesuaikan path import icon-nya

export const menuSections = [ 
    {
        sectionKey: 'procurement',
        sectionLabel: 'Procurement',
        defaultCollapsed: false,
        items: [
            { key: 'dashboard',     windowKey: 'dashboard',    path: '/dashboard',      label: 'Dashboard',     icon: <HomeIcon /> },
            { key: 'requisition',   windowKey: 'requisition',  path: '/requisition',    label: 'Requisition',   icon: <RequisitionIcon /> },
            { key: 'purchasing',    windowKey: 'purchasing',   path: '/purchasing',     label: 'Purchasing',    icon: <ShoppingCartIcon /> },
            { key: 'goodsReceipt',  windowKey: 'goodsReceipt', path: '/goods-receipt', label: 'Goods Receipt', icon: <DeliveryIcon /> },
            { key: 'internalUse',   windowKey: 'internalUse',  path: '/internal-use',  label: 'Internal Use',  icon: <UserTake /> },
        ]
    },
    {
        sectionKey: 'sales',
        sectionLabel: 'Salses POS',
        defaultCollapsed: false,
        items: [
            { key: 'pos-order',     windowKey: 'pos',    path: '/pos-order',        label: 'Pos Sales',     icon: <CashierIcon size={20}/> },
            { key: 'booking',       windowKey: 'booking', path: '/booking',         label: 'Booking Timeline',  icon: <UserTake /> },
            ]
    },
    {
        sectionKey: 'report',
        sectionLabel: 'Report',
        defaultCollapsed: true,
            items: [
            { key: 'requisition-list', windowKey: 'requisitionList', borderTop: true, path: '/requisition-list',  label: 'Requisition List',    icon: <ListIconR /> },
            { key: 'purchasing-list',  windowKey: 'purchasingList',  path: '/purchasing-list',   label: 'Purchasing List',     icon: <ListIconP /> },
            { key: 'goodsreceipt-list', windowKey: 'goodsReceiptList', path: '/goodsreceipt-list', label: 'Goods Receipt List', icon: <ListIconG /> },
            { key: 'internaluse-list', windowKey: 'internalUseList',  path: '/internaluse-list',  label: 'Internal Use List',   icon: <ListIconA /> },
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
