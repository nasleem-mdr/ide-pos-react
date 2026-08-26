import { useState, useRef } from 'react';
import { Printer, Download, FileBarChart, Loader2 } from 'lucide-react';
import { useFinancialReport } from '@/features/financial/hooks/useFinancialReport';
import FinancialReportModal from '@/features/financial/component/FinancialReportModal';

// TODO: sesuaikan reportLineSetId dengan PA_ReportLineSet_ID yang sebenarnya
// di instance iDempiere kamu (cek via window Financial Report / Postman).
const REPORT_TYPES = [
  { id: 'neraca', label: 'Neraca', reportLineSetId: 1000123, isPeriodic: false },
  { id: 'labarugi', label: 'Laba Rugi', reportLineSetId: 1000124, isPeriodic: true },
];

function formatRupiah(amount) {
  const value = Math.round(amount || 0);
  const formatted = Math.abs(value).toLocaleString('id-ID');
  return value < 0 ? `(${formatted})` : formatted;
}

export default function FinancialReportPage({ token, acctSchemaId }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeParams, setActiveParams] = useState(null); // { reportType, reportLineSetId, dateFrom, dateTo }
  const printAreaRef = useRef(null);

  const { reportLines, loading, error } = useFinancialReport({
    reportLineSetId: activeParams?.reportLineSetId,
    acctSchemaId,
    dateFrom: activeParams?.dateFrom,
    dateTo: activeParams?.dateTo,
    mode: activeParams?.reportType === 'labarugi' ? 'labarugi' : 'neraca',
    token,
  });

  const activeTypeLabel = REPORT_TYPES.find((t) => t.id === activeParams?.reportType)?.label;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    // Pakai html2canvas + jsPDF supaya tidak perlu backend tambahan.
    // Install dulu: npm install jspdf html2canvas
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(printAreaRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
    pdf.save(`${activeParams?.reportType || 'laporan'}-${activeParams?.dateTo}.pdf`);
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Toolbar — disembunyikan saat print */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-semibold text-gray-800">Laporan Keuangan</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FileBarChart size={16} />
            Pilih Laporan
          </button>
          {activeParams && (
            <>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer size={16} />
                Print
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download size={16} />
                Unduh PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Konten laporan */}
      {!activeParams && (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
          Klik &quot;Pilih Laporan&quot; untuk menampilkan Neraca atau Laba Rugi.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 p-10 text-gray-500">
          <Loader2 className="animate-spin" size={20} />
          Memuat laporan...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && activeParams && (
        <div
          ref={printAreaRef}
          id="financial-report-print-area"
          className="rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="mb-4 text-center">
            <h2 className="text-lg font-bold text-gray-800">{activeTypeLabel}</h2>
            <p className="text-sm text-gray-500">
              {activeParams.reportType === 'labarugi'
                ? `Periode ${activeParams.dateFrom} s/d ${activeParams.dateTo}`
                : `Per ${activeParams.dateTo}`}
            </p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              {reportLines
                .slice()
                .sort((a, b) => a.seqNo - b.seqNo)
                .map((line) => (
                  <tr
                    key={line.id}
                    className={line.lineType === 'C' ? 'border-t font-semibold text-gray-900' : 'text-gray-700'}
                  >
                    <td className="py-1 pl-2">{line.name}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">
                      {formatRupiah(line.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <FinancialReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onApply={(params) => setActiveParams(params)}
        reportTypes={REPORT_TYPES}
      />

      {/* Print CSS: sembunyikan semua kecuali area laporan saat print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #financial-report-print-area, #financial-report-print-area * { visibility: visible; }
          #financial-report-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
