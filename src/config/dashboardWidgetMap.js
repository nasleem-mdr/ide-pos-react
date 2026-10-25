import { lazy } from 'react';

export const dashboardWidgetMap = {
  generalLedger   : { windowKey: 'generalLegder', component: lazy(() => import('@/features/reporting/financial/pages/GeneralLedgerReport')) },
  procurementStats: { windowKey: 'procurementTrace',   component: lazy(() => import('@/features/reporting/procurement/pages/ProcurementTraceReport')) },
  trendReport     : { windowKey: 'trendReport', component: lazy(() => import('@/features/reporting/financial/pages/MonthlyTrendReport')) },
  //salesStats:       { windowKey: 'posOrder',      component: lazy(() => import('@/features/dashboard/widgets/SalesStats')) },
  // ...dst
};