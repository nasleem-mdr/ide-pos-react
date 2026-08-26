import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * FinancialReportModal
 * ---------------------
 * Modal untuk memilih jenis laporan keuangan (Neraca / Laba Rugi) beserta
 * parameternya (periode tanggal), sebelum dikirim ke useFinancialReport.
 *
 * Modal ini standalone (tidak bergantung ke komponen Dialog existing kamu),
 * supaya gampang di-drop-in. Kalau mau konsisten pakai Dialog generic yang
 * sudah ada di project, tinggal bungkus <div className="fixed inset-0..."> di
 * bawah ini dengan komponen Dialog kamu.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(params: { reportType: string, reportLineSetId: number, dateFrom: string, dateTo: string }) => void} props.onApply
 * @param {Array<{ id: string, label: string, reportLineSetId: number, isPeriodic: boolean }>} props.reportTypes
 *        Konfigurasi jenis laporan yang tersedia. Contoh:
 *        [
 *          { id: 'neraca', label: 'Neraca', reportLineSetId: 1000123, isPeriodic: false },
 *          { id: 'labarugi', label: 'Laba Rugi', reportLineSetId: 1000124, isPeriodic: true },
 *        ]
 *        reportLineSetId WAJIB diisi sesuai PA_ReportLineSet_ID di instance kamu.
 */
export default function FinancialReportModal({ open, onClose, onApply, reportTypes = [] }) {
  const [selectedTypeId, setSelectedTypeId] = useState(reportTypes[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selectedType = reportTypes.find((t) => t.id === selectedTypeId);

  // Reset form tiap kali modal dibuka
  useEffect(() => {
    if (open) {
      setSelectedTypeId(reportTypes[0]?.id ?? '');
      const today = new Date().toISOString().slice(0, 10);
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      setDateFrom(firstOfMonth.toISOString().slice(0, 10));
      setDateTo(today);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isValid = selectedType && dateTo && (!selectedType.isPeriodic || dateFrom);

  const handleApply = () => {
    if (!isValid) return;
    onApply({
      reportType: selectedType.id,
      reportLineSetId: selectedType.reportLineSetId,
      dateFrom: selectedType.isPeriodic ? dateFrom : undefined,
      dateTo,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Cetak Laporan Keuangan</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Pilihan jenis laporan */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jenis Laporan</label>
            <div className="grid grid-cols-2 gap-2">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedTypeId(type.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    selectedTypeId === type.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal mulai — hanya untuk laporan periodik (Laba Rugi) */}
          {selectedType?.isPeriodic && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Tanggal akhir / cutoff */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {selectedType?.isPeriodic ? 'Sampai Tanggal' : 'Per Tanggal (Cutoff)'}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {!selectedType?.isPeriodic && (
              <p className="mt-1 text-xs text-gray-400">
                Neraca dihitung kumulatif sejak awal buku sampai tanggal ini.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            onClick={handleApply}
            disabled={!isValid}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tampilkan Laporan
          </button>
        </div>
      </div>
    </div>
  );
}
