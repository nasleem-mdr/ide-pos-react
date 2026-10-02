import { Link } from 'react-router-dom';
import { ShoppingCartIcon, DeliveryIcon, RequisitionIcon, UserTake, VendorIcon, CashierIcon, BankIcon, ImportIcon } from '@/shared/components/icon';
import { MdOutlinePayments } from "react-icons/md";
import { SiGoogleanalytics } from "react-icons/si";
import { useAccess } from '@/context/AccessContext';

// windowKey HARUS sama dengan yang di menuConfig.jsx
const CARDS = [
  { windowKey: 'requisition',    to: '/requisition',     icon: <RequisitionIcon size={36} />,   label: 'Formulir', value: 'Requisition' },
  { windowKey: 'purchasing',     to: '/purchasing',      icon: <ShoppingCartIcon size={32} />,  label: 'Formulir', value: 'Purchase Order' },
  { windowKey: 'goodsReceipt',   to: '/goods-receipt',   icon: <DeliveryIcon size={38} />,      label: 'Formulir', value: 'Goods Receipt' },
  { windowKey: 'internalUse',    to: '/internal-use',    icon: <UserTake size={32} />,          label: 'Formulir', value: 'Internal Use' },
  { windowKey: 'vendorInvoice',  to: '/vendor-invoice',  icon: <VendorIcon size={32} />,        label: 'Formulir', value: 'Purchase Invoice' },
  { windowKey: 'posOrder',       to: '/pos-order',       icon: <CashierIcon size={32} />,       label: 'Formulir', value: 'POS Sales' },
  { windowKey: 'salesInvoice',   to: '/sales-invoice',   icon: <ImportIcon size={32} />,        label: 'Formulir', value: 'Sales Invoice' },
  { windowKey: 'paymentReceipt', to: '/payment-receipt', icon: <MdOutlinePayments size={32} />, label: 'Formulir', value: 'Payment and Receipt' },
  { windowKey: 'bankstatement',  to: '/bank-statement',  icon: <BankIcon size={32} />,          label: 'Formulir', value: 'Bank Statement' },
  { windowKey: 'dashboardMenu',  to: '/dashboard-menu',  icon: <SiGoogleanalytics size={32} />, label: 'Report',   value: 'All Report' },
];

function CardBody({ icon, label, value }) {
  return (
    <div className="welcome-card">
      <div className="welcome-card-icon">{icon}</div>
      <div className="welcome-card-label">{label}</div>
      <div className="welcome-card-value">{value}</div>
    </div>
  );
}

export default function WelcomeCards({ session }) {
  const { canView, loading } = useAccess();

  return (
    <div className="welcome-cards">
      {CARDS.map(({ windowKey, to, ...body }) => {
        const allowed = !loading && canView(windowKey);

        return allowed ? (
          <Link key={windowKey} to={to} className="welcome-card-link">
            <CardBody {...body} />
          </Link>
        ) : (
          <div
            key={windowKey}
            className="welcome-card-link welcome-card-link--disabled"
            aria-disabled="true"
            title={loading ? 'Memuat hak akses...' : 'Anda tidak memiliki akses ke menu ini'}
          >
            <CardBody {...body} />
          </div>
        );
      })}
    </div>
  );
}