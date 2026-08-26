import { useState, useEffect, useCallback } from 'react';

/**
 * useFinancialReport (Optimized Version)
 * --------------------------------------
 * Hook untuk mengambil dan mengolah data Neraca / Laba Rugi
 * dari REST API iDempiere secara efisien dan aman.
 *
 * PERBAIKAN BUG & OPTIMASI PERFORMA:
 * 1. Bug Foreign Key Object: iDempiere REST API mengembalikan FK sebagai Object { id: 123 }
 *    atau ID primitif. Ditambahkan helper `getId()` agar pembandingan ID 100% konsisten.
 * 2. Bug String Arithmetic: `AmtAcctDr` / `AmtAcctCr` dari JSON REST API sering berupa String.
 *    Ditambahkan helper `parseNum()` untuk mencegah bug konkat string ("0" + "100" = "0100").
 * 3. Optimasi Parallel Fetch: Metadata (PA_ReportLine, PA_ReportSource, C_ElementValue)
 *    di-fetch secara paralel menggunakan `Promise.all` (menghemat ~60-70% RTT jaringan awal).
 * 4. Optimasi Algoritma Search Range ($O(N) \to O(K)$): Resolusi range akun menggunakan
 *    `break` early-exit pada array terurut, menghapus ribuan operasi `localeCompare` tak perlu.
 * 5. Optimasi Grouping ($O(L \times S) \to O(1)$): Pre-grouping `PA_ReportSource` berdasarkan
 *    `PA_ReportLine_ID` ke Map sebelum iterasi kalkulasi.
 * 6. Memory Allocation: Mengganti `concat()` berulang dengan `push(...rows)` di pagination.
 * 7. Race Condition & Abort Signal: Penanganan `AbortController` agar request lama otomatis
 *    batal jika parameter berubah/unmount sebelum fetch selesai.
 */

// Helper: Normalisasi ID (baik bernilai integer maupun object { id: ... })
const getId = (val) => (val && typeof val === 'object' && 'id' in val ? val.id : val);

// Helper: Safety parse angka dari response JSON API
const parseNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper: Tentukan saldo normal
const isDebitNormal = (accountType, accountSign) => {
  if (accountSign === 'D') return true;
  if (accountSign === 'C') return false;
  // AccountSign 'N' (Natural) -> Fallback ke AccountType (A: Asset, E: Expense, M: Memo)
  return accountType === 'A' || accountType === 'E' || accountType === 'M';
};

export function useFinancialReport({
  reportLineSetId,
  acctSchemaId,
  dateFrom,
  dateTo,
  mode = 'neraca',
  token,
  baseUrl = '',
}) {
  const [reportLines, setReportLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper fetch all pages dengan AbortSignal & memory optimization
  const fetchAllPages = useCallback(
    async (path, pageSize = 1000, signal = null) => {
      let skip = 0;
      const allRows = [];
      
      while (true) {
        const sep = path.includes('?') ? '&' : '?';
        const url = `${baseUrl}${path}${sep}$top=${pageSize}&$skip=${skip}`;
        
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });

        if (!res.ok) {
          throw new Error(`Gagal fetch ${path}: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();
        const rows = json.records || json.value || [];
        for (let i = 0; i < rows.length; i++) {
          allRows.push(rows[i]);
        }

        if (rows.length === 0) break;   // ganti kondisi berhenti
        skip += rows.length;            // pakai jumlah row ASLI yang balik, bukan pageSize yang diminta
      }
      return allRows;
    },
    [baseUrl, token]
  );

  // Evaluator rekursif dengan Memoization + Cycle Detection
  const evaluateLine = useCallback((lineId, linesById, segmentAmounts, cache, visiting, depth = 0) => {
    if (cache.has(lineId)) return cache.get(lineId);

    if (visiting.has(lineId) || depth > 50) {
      console.warn(
        `useFinancialReport: Circular reference atau kedalaman berlebih pada PA_ReportLine_ID ${lineId}`
      );
      return 0;
    }

    const line = linesById.get(lineId);
    if (!line) return 0;

    if (line.LineType?.id !== 'C') {   // ganti dari line.LineType !== 'C'
      const val = segmentAmounts.get(lineId) || 0;
      cache.set(lineId, val);
      return val;
    }

    visiting.add(lineId);

    const op1Id = getId(line.Oper_1_ID);
    const op2Id = getId(line.Oper_2_ID);

    const a = op1Id ? evaluateLine(op1Id, linesById, segmentAmounts, cache, visiting, depth + 1) : 0;
    const b = op2Id ? evaluateLine(op2Id, linesById, segmentAmounts, cache, visiting, depth + 1) : 0;

    let result = 0;
    switch (line.CalculationType?.id) { 
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        result = b !== 0 ? a / b : 0;
        break;
      case 'P': // Percentage
        result = b !== 0 ? (a / b) * 100 : 0;
        break;
      default:
        result = 0;
    }

    visiting.delete(lineId);
    cache.set(lineId, result);
    return result;
  }, []);

  const buildReport = useCallback(
    async (signal = null) => {
      if (!reportLineSetId || !acctSchemaId || !dateTo || !token) return;

      setLoading(true);
      setError(null);

      try {
        // ------------------------------------------------------------------
        // 1. OPTIMASI PERFORMA: Concurrent Fetching untuk Metadata
        // ------------------------------------------------------------------
        const [lines, allSources, allAccounts] = await Promise.all([
          fetchAllPages(
            `/api/v1/models/PA_ReportLine?$filter=PA_ReportLineSet_ID eq ${reportLineSetId} and IsActive eq true&$orderby=SeqNo`,
            1000,
            signal
          ),
          fetchAllPages(
            `/api/v1/models/PA_ReportSource?$filter=ElementType eq 'AC' and IsActive eq true`,
            1000,
            signal
          ),
          fetchAllPages(
            `/api/v1/models/C_ElementValue?$filter=IsActive eq true&$select=C_ElementValue_ID,Name,Value,AccountType,AccountSign,IsSummary`,
            1000,
            signal
          ),
        ]);
        
        if (lines.length === 0) {
          console.warn('useFinancialReport — PA_ReportLine kosong untuk reportLineSetId ini, report akan kosong');
          setReportLines([]);
          setLoading(false);
          return;
        }
        
        // ------------------------------------------------------------------
        // 2. PRE-PROCESSING & INDEXING MAPS
        // ------------------------------------------------------------------
        const accountMap = new Map();
        for (const acc of allAccounts) {
          accountMap.set(acc.id, acc);  
        }

        // Sort akun berdasarkan Value (String) untuk pencarian Range cepat
        const accountsByValue = [...allAccounts].sort((a, b) =>
          String(a.Value).localeCompare(String(b.Value))
        );

        // Pre-grouping PA_ReportSource berdasarkan PA_ReportLine_ID (O(1) Access)
        const sourcesByLineId = new Map();
        for (const source of allSources) {
          const lineId = getId(source.PA_ReportLine_ID);
          if (lineId) {
            if (!sourcesByLineId.has(lineId)) {
              sourcesByLineId.set(lineId, []);
            }
            sourcesByLineId.get(lineId).push(source);
          }
        }

        // Cache untuk resolusi Range Akun agar tidak dihitung berulang
        const resolvedAccountsCache = new Map();

        // Helper: cek IsSummary secara toleran terhadap boolean atau 'Y'/'N'
        const isSummaryAccount = (acc) => acc?.IsSummary === true || acc?.IsSummary === 'Y';

        const resolveAccountIds = (source) => {
          const sourceId = getId(source.PA_ReportSource_ID);
          if (sourceId && resolvedAccountsCache.has(sourceId)) {
            return resolvedAccountsCache.get(sourceId);
          }

          const fromId = getId(source.C_ElementValue_ID);
          const toId = getId(source.C_ElementValue_To_ID);
          if (!fromId) return [];

          const fromAcc = accountMap.get(fromId);

          // Kalau 'From' adalah akun Summary tanpa 'To' eksplisit,
          // treat sebagai parent: rollup ke semua child non-summary
          // yang Value-nya diawali prefix Value akun summary ini.
          if ((!toId || toId === fromId) && isSummaryAccount(fromAcc)) {
            const prefix = String(fromAcc.Value);
            const matched = [];
            for (const acc of accountsByValue) {
              if (!isSummaryAccount(acc) && String(acc.Value).startsWith(prefix)) {
                matched.push(acc.id);
              }
            }
            if (sourceId) resolvedAccountsCache.set(sourceId, matched);
            return matched;
          }

          if (!toId || toId === fromId) return [fromId];

          const toAcc = accountMap.get(toId);
          if (!fromAcc || !toAcc) return [fromId, toId].filter(Boolean);

          const fromVal = String(fromAcc.Value);
          const toVal = String(toAcc.Value);

          const matchedIds = [];
          for (let i = 0; i < accountsByValue.length; i++) {
            const acc = accountsByValue[i];
            const accVal = String(acc.Value);
            if (accVal >= fromVal && accVal <= toVal) {
              if (!isSummaryAccount(acc)) {
                matchedIds.push(acc.id);
              }
            } else if (accVal > toVal) {
              break;
            }
          }

          if (sourceId) resolvedAccountsCache.set(sourceId, matchedIds);
          return matchedIds;
        };
        console.log('Value akun summary 1000057:', accountMap.get(1000057)?.Value, accountMap.get(1000057)?.Name);
        console.log('Semua akun (Value, IsSummary, Name):',
          JSON.stringify(
            Array.from(accountMap.values())
              .map(a => ({ id: a.id, value: a.Value, isSummary: a.IsSummary, name: a.Name }))
              .sort((a, b) => String(a.value).localeCompare(String(b.value)))
          , null, 2)
        );
        // ------------------------------------------------------------------
        // 3. FETCH DATA TRANSKASI (Fact_Acct)
        // ------------------------------------------------------------------
        const dateFilter =
          mode === 'neraca'
            ? `DateAcct le '${dateTo}'`
            : `DateAcct ge '${dateFrom}' and DateAcct le '${dateTo}'`;

            const factRows = await fetchAllPages(
              `/api/v1/models/Fact_Acct?$filter=C_AcctSchema_ID eq ${acctSchemaId} and PostingType eq 'A' and ${dateFilter}&$select=Account_ID,AmtAcctDr,AmtAcctCr`,
              2000,
              signal
            );
            
            console.log('useFinancialReport — dateFilter:', dateFilter);
            console.log('useFinancialReport — jumlah Fact_Acct rows:', factRows.length, factRows.slice(0, 5));
        // ------------------------------------------------------------------
        // 4. AGREGASI SALDO PER AKUN
        // ------------------------------------------------------------------
        const balanceByAccount = new Map();
        for (let i = 0; i < factRows.length; i++) {
          const row = factRows[i];
          const accId = getId(row.Account_ID);
          if (!accId) continue;

          // Perbaikan String concatenation bug
          const dr = parseNum(row.AmtAcctDr);
          const cr = parseNum(row.AmtAcctCr);

          const prev = balanceByAccount.get(accId);
          if (prev) {
            prev.dr += dr;
            prev.cr += cr;
          } else {
            balanceByAccount.set(accId, { dr, cr });
          }
        }

        const getAccountBalance = (accId) => {
          const bal = balanceByAccount.get(accId);
          if (!bal) return 0;
          const acc = accountMap.get(accId);
          const debitNormal = acc ? isDebitNormal(acc.AccountType, acc.AccountSign) : true;
          return debitNormal ? bal.dr - bal.cr : bal.cr - bal.dr;
        };

        // ------------------------------------------------------------------
        // 5. KALKULASI SEGMENT LINES ('S')
        // ------------------------------------------------------------------
        const segmentAmounts = new Map();
        console.log('Semua lines:', lines.map(l => ({ id: l.id, name: l.Name, type: l.LineType })));
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineId = line.id;
          if (line.LineType?.id !== 'S') continue;
        
          const sourcesForLine = sourcesByLineId.get(lineId) || [];
          let total = 0;
        
          console.log(`Line "${line.Name}" (${lineId}) — jumlah PA_ReportSource:`, sourcesForLine.length);
        
          for (let j = 0; j < sourcesForLine.length; j++) {
            const accIds = resolveAccountIds(sourcesForLine[j]);
            console.log(`  Source #${j} —`, sourcesForLine[j], '-> resolved accIds:', accIds);
            for (let k = 0; k < accIds.length; k++) {
              const bal = getAccountBalance(accIds[k]);
              console.log(`    accId ${accIds[k]} -> balance:`, bal);
              total += bal;
            }
          }
        
          console.log(`Line "${line.Name}" total:`, total);
          segmentAmounts.set(lineId, total);
        }
        // ------------------------------------------------------------------
        // 6. EVALUASI BARIS KALKULASI ('C') VIA REKURSION & MEMOIZATION
        // ------------------------------------------------------------------
        const linesById = new Map();
        for (let i = 0; i < lines.length; i++) {
          linesById.set(lines[i].id, lines[i]);
        }

        const cache = new Map();
        const finalAmounts = new Map();

        for (let i = 0; i < lines.length; i++) {
          const lineId = lines[i].id;
          finalAmounts.set(
            lineId,
            evaluateLine(lineId, linesById, segmentAmounts, cache, new Set())
          );
        }

        // ------------------------------------------------------------------
        // 7. HASIL AKHIR
        // ------------------------------------------------------------------
        const result = lines.map((line) => {
          const lineId = line.id;
          return {
            id: lineId,
            name: line.Name,
            description: line.Description,   // ← baris baru
            seqNo: line.SeqNo,
            lineType: line.LineType?.id, 
            isDetail: line.IsDetail === true || line.IsDetail === 'Y',
            isPageBreak: line.IsPageBreak === true || line.IsPageBreak === 'Y',
            amount: finalAmounts.get(lineId) || 0,
          };
        });
        console.log('Sample line mentah:', JSON.stringify(lines[0]));
        setReportLines(result);
      } catch (err) {
        if (err.name === 'AbortError') {
          // Request dibatalkan (komponen unmount / param berubah), abaikan error
          return;
        }
        setError(err.message || 'Gagal memuat laporan keuangan');
      } finally {
        setLoading(false);
      }
    },
    [reportLineSetId, acctSchemaId, dateFrom, dateTo, mode, token, fetchAllPages, evaluateLine]
  );

  useEffect(() => {
    const controller = new AbortController();
    buildReport(controller.signal);

    return () => {
      controller.abort(); // Cancel pending fetch jika dependency berubah
    };
  }, [buildReport]);

  return {
    reportLines,
    loading,
    error,
    refetch: () => buildReport(),
  };
}

export default useFinancialReport;
