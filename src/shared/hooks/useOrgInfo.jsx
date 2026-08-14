// src/shared/hooks/useOrgInfo.js
import { useState, useEffect } from 'react';
import { idempiereApi, getModelRecords, fkId } from '@/api/idempiereApi';
import { getLoginInfo } from './useLoginInfo';

// Cache in-memory per AD_Org_ID — info Org jarang berubah dalam satu sesi,
// jadi tidak perlu re-fetch tiap kali komponen report header di-mount.
const _cache = new Map(); // orgId -> Promise<orgInfo | null>

async function fetchOrgInfoRaw(orgId) {
  const res = await getModelRecords('ad_orginfo', {
    '$filter': `AD_Org_ID eq ${orgId}`,
    '$select': 'AD_Org_ID,Phone,Email,Logo_ID',
    '$top': 1,
  });
  const record = res?.records?.[0];
  if (!record) return null;

  // Name diambil dari identifier FK AD_Org_ID (bawaan iDempiere REST —
  // FK selalu membawa {id, identifier}, dan identifier AD_Org = Name-nya).
  // TIDAK perlu query kedua ke ad_org kalau ini konsisten di instance kalian.
  let name = record.AD_Org_ID?.identifier || '';

  let logoUrl = null;
  const logoId = fkId(record.Logo_ID);
  if (logoId) {
    try {
      const img = await idempiereApi(`/models/ad_image/${logoId}?$select=AD_Image_ID,Name,BinaryData`);
      if (img?.BinaryData) {
        logoUrl = `data:image/png;base64,${img.BinaryData}`;
      }
    } catch (err) {
      console.warn('[useOrgInfo] Gagal ambil logo AD_Image:', err.message);
    }
  }

  return {
    orgId,
    name,
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

export function clearOrgInfoCache(orgId) {
  if (orgId) _cache.delete(orgId);
  else _cache.clear();
}