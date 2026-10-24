import { lazy } from 'react';

export const dashboardWidgetMap = {
  procurementStats: { windowKey: 'generalLegder', component: lazy(() => import('@/features/reporting/financial/pages/GeneralLedgerReport')) },
  pendingFPB:       { windowKey: 'procurementTrace',   component: lazy(() => import('@/features/reporting/procurement/pages/ProcurementTraceReport')) },
  //financeSummary:   { windowKey: 'bankStatement', component: lazy(() => import('@/features/dashboard/widgets/FinanceSummary')) },
  //salesStats:       { windowKey: 'posOrder',      component: lazy(() => import('@/features/dashboard/widgets/SalesStats')) },
  // ...dst
};