import { useEffect, useRef, useState } from "react";
import { Timeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import { useResourceBooking, BookingValidationError } from "@/shared/hooks/useResourceBooking";

/**
 * BookingTimeline
 * ----------------
 * Port dari meetingroom.zul + booking.js (vis.Timeline) ke React.
 * vis-timeline murni JS, jadi dipasang manual ke div via useRef -
 * tidak butuh wrapper React khusus.
 *
 * @param {number} resourceTypeId - S_ResourceType_ID, mis. ID tipe "Ruang Meeting"
 */
export default function BookingTimeline({ resourceTypeId, docTypeTargetId }) {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const itemsDataSetRef = useRef(null);
  const groupsDataSetRef = useRef(null);

  const {
    groups,
    items,
    loading,
    error,
    refresh,
    createBooking,
    updateBookingTime,
    voidBooking,
  } = useResourceBooking(resourceTypeId, docTypeTargetId);

  const [draft, setDraft] = useState(null); // form dialog state, pengganti jQuery UI dialog di versi asli

  // Load awal: rentang default 1 bulan ke belakang - 3 bulan ke depan
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    refresh(start, end);
  }, [refresh]);

  // Inisialisasi vis-timeline sekali saja
  useEffect(() => {
    if (!containerRef.current || timelineRef.current) return;

    groupsDataSetRef.current = new DataSet([]);
    itemsDataSetRef.current = new DataSet([]);

    const options = {
      editable: {
        add: true, // double-click kosong -> buat booking baru
        updateTime: true, // drag / resize
        updateGroup: true, // pindah antar resource (baris)
        remove: true,
      },
      orientation: "top",
      margin: { item: 8, axis: 4 },
      stack: true,
      zoomMin: 1000 * 60 * 60, // 1 jam
      zoomMax: 1000 * 60 * 60 * 24 * 90, // 90 hari

      // --- setara BookingTimeline.onEvent() / booking.js dialog buka ---
      onAdd: (item, callback) => {
        setDraft({
          mode: "create",
          sResourceId: Number(item.group),
          assignFrom: item.start.toISOString(),
          assignTo: (item.end || new Date(item.start.getTime() + 60 * 60 * 1000)).toISOString(),
          name: "",
          description: "",
          isWeekly: false,
          weeklyEndDate: "",
        });
        callback(null); // batal insert langsung ke DataSet; kita insert manual setelah form disimpan & tervalidasi server
      },

      // --- setara updateBookingTime() (drag & resize) ---
      onMove: async (item, callback) => {
        try {
          await updateBookingTime(Number(item.id), {
            resourceId: Number(item.group),
            start: item.start.toISOString(),
            end: item.end.toISOString(),
          });
          callback(item);
        } catch (e) {
          alert(e instanceof BookingValidationError ? e.message : "Gagal memindahkan booking.");
          callback(null); // revert posisi visual
        }
      },

      onRemove: async (item, callback) => {
        if (!window.confirm(`Void booking "${item.content}"? (Bukan hapus permanen)`)) {
          callback(null);
          return;
        }
        try {
          await voidBooking(Number(item.id));
          callback(item);
        } catch (e) {
          alert("Gagal membatalkan booking.");
          callback(null);
        }
      },
    };

    timelineRef.current = new Timeline(
      containerRef.current,
      itemsDataSetRef.current,
      groupsDataSetRef.current,
      options
    );

    return () => {
      timelineRef.current?.destroy();
      timelineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan data hook -> DataSet vis-timeline setiap kali groups/items berubah
  useEffect(() => {
    groupsDataSetRef.current?.clear();
    groupsDataSetRef.current?.add(groups);
  }, [groups]);

  useEffect(() => {
    itemsDataSetRef.current?.clear();
    itemsDataSetRef.current?.add(items);
  }, [items]);

  async function handleSubmitDraft(e) {
    e.preventDefault();
    try {
      await createBooking(draft);
      setDraft(null);
      const now = new Date();
      await refresh(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth() + 3, 1)
      );
    } catch (err) {
      alert(err instanceof BookingValidationError ? err.message : "Gagal menyimpan booking.");
    }
  }

  return (
    <div>
      {loading && <p>Memuat jadwal...</p>}
      {error && (
        <p style={{ color: "crimson" }}>
          Gagal memuat data booking: {error.message || "cek console untuk detail"}
        </p>
      )}

      <div ref={containerRef} style={{ height: 500, border: "1px solid #ddd" }} />

      {/* Form dialog pengganti jQuery UI #update-form di meetingroom.zul */}
      {draft && (
        <div style={dialogStyle}>
          <form onSubmit={handleSubmitDraft} style={dialogBoxStyle}>
            <h3>Booking Baru</h3>
            <label>
              Nama
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
              />
            </label>
            <label>
              Deskripsi
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.isWeekly}
                onChange={(e) => setDraft({ ...draft, isWeekly: e.target.checked })}
              />
              Ulangi tiap minggu sampai
            </label>
            {draft.isWeekly && (
              <input
                type="date"
                value={draft.weeklyEndDate}
                onChange={(e) => setDraft({ ...draft, weeklyEndDate: e.target.value })}
              />
            )}
            {/* Attendee picker (S_BookingAttendee) belum diaktifkan lagi di versi ini -
                nanti ditambahkan setelah GET/POST s_booking dan s_resource dipastikan jalan dulu. */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="submit">Simpan</button>
              <button type="button" onClick={() => setDraft(null)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const dialogStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const dialogBoxStyle = {
  background: "#f45",
  padding: 20,
  borderRadius: 8,
  width: 320,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};