import { HomeIcon, RequisitionIcon, ShoppingCartIcon, DeliveryIcon, UserTake, ListIconR, ListIconP, ListIconG, ListIconA, PartnerIcon, BoxIcon, } from '../components/Icons'; // sesuaikan path import icon-nya

export const menuSections = [ 
    {
        sectionKey: 'transaksi',
        sectionLabel: 'Transaksi',
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
