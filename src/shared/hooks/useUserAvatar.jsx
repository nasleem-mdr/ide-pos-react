import { useEffect, useState } from 'react';
import { idempiereApi, fkId } from '@/utils/idempiereApi';

async function fetchBlobUrl(path) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.size) return null;
  return URL.createObjectURL(blob);
}

export function useUserAvatar() {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem('AD_User_ID');
    if (!userId) return;
    let objectUrl = null;
    let cancelled = false;

    (async () => {
      try {
        // 1) Avatar_ID → AD_Image.BinaryData
        const user = await idempiereApi(`/models/ad_user/${userId}?$select=Avatar_ID`);
        const imageId = fkId(user?.Avatar_ID);
        if (imageId) {
          objectUrl = await fetchBlobUrl(`/models/ad_image/${imageId}/BinaryData`);
        }

        // 2) Fallback: attachment gambar di record AD_User
        if (!objectUrl) {
          const att = await idempiereApi(`/models/ad_user/${userId}/attachments`);
          const img = (att?.attachments || []).find(a => a.contentType?.startsWith('image/'));
          if (img) {
            objectUrl = await fetchBlobUrl(
              `/models/ad_user/${userId}/attachments/${encodeURIComponent(img.name)}`
            );
          }
        }
      } catch (_) { /* tidak ada foto → pakai fallback */ }

      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } else {
        setUrl(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return url;
}
