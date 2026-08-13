// src/shared/hooks/useOrgInfo.js
import { useState, useEffect } from 'react';
import { idempiereApi, getModelRecords, fkId } from '@/api/idempiereApi';
import { getLoginInfo } from './useLoginInfo';

// Cache in-memory per AD_Org_ID — info Org jarang berubah dalam satu sesi,
// jadi tidak perlu re-fetch tiap kali komponen report header di-mount.
// Pola sama seperti _cache di docTypeResolver.jsx.
const _cache = new Map(); // orgId -> Promise<orgInfo | null>

async function fetchOrgInfoRaw(orgId) {
  const res = await getModelRecords('ad_orginfo', {
    '$filter': `AD_Org_ID eq ${orgId}`,
    '$select': 'AD_Org_ID,Name,Phone,Email,Logo_ID',
    '$top': 1,
  });
  const record = res?.records?.[0];
  if (!record) return null;

  let logoUrl = null;
  const logoId = fkId(record.Logo_ID);
  if (logoId) {
    try {
      // PENTING: nama kolom binary/mimetype di AD_Image belum dikonfirmasi
      // di instance bxservice kalian — cek dulu lewat GET manual ke
      // /models/ad_image/{id} untuk lihat nama field persisnya (kemungkinan
      // BinaryData / Data, dan MimeType), lalu sesuaikan $select di bawah.
      const img = await idempiereApi(`/models/ad_image/${logoId}?$select=BinaryData,MimeType`);
      if (img?.BinaryData) {
        const mime = img.MimeType || 'image/png';
        logoUrl = `data:${mime};base64,${img.BinaryData}`;
      }
    } catch (err) {
      console.warn('[useOrgInfo] Gagal ambil logo AD_Image:', err.message);
    }
  }

  return {
    orgId,
    name:  record.Name  || '',
    phone: record.Phone || '',
    email: record.Email || '',
    logoUrl,
  };
}

/**
 * useOrgInfo — ambil Name/Phone/Email/Logo dari AD_OrgInfo untuk Org yang
 * sedang login (atau orgId eksplisit kalau di-pass). Dipakai untuk report
 * header lintas modul (Sales Invoice, PO, Vendor Invoice, dll).
 */
export function useOrgInfo(orgIdParam) {
  const [orgInfo, setOrgInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const orgId = orgIdParam ?? getLoginInfo()?.orgId;
    if (!orgId) { setLoading(false); return; }

    setLoading(true);
    if (!_cache.has(orgId)) {
      _cache.set(orgId, fetchOrgInfoRaw(orgId));
    }
    _cache.get(orgId)
      .then(info => { if (!cancelled) setOrgInfo(info); })
      .catch(err => {
        console.error('[useOrgInfo]', err.message);
        if (!cancelled) setOrgInfo(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [orgIdParam]);

  return { orgInfo, loading };
}

// Manual refetch kalau admin ubah data Org tanpa reload aplikasi.
export function clearOrgInfoCache(orgId) {
  if (orgId) _cache.delete(orgId);
  else _cache.clear();
}