import React, { useState } from "react";
import { useWorkflowProgress } from "@/shared/hooks/useWorkflowProgress";

const COLORS = {
    done:    { bg: "#808000", fg: "#000" },
    current: { bg: "#f57c00", fg: "#fff" },
    aborted: { bg: "#c62828", fg: "#fff" },
    pending: { bg: "#d4d4d4", fg: "#666" },
};
const STATUS_TEXT = { done: "Selesai", current: "Menunggu", aborted: "Ditolak / Dihentikan", pending: "Belum dijalankan" };

const fmtTime = (t) => (t ? new Date(t).toLocaleString("id-ID") : "-");

// ---------- elemen grafik ----------
const Connector = ({ active }) => (
    <div style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
        <div style={{ width: 36, borderTop: `3px ${active ? "solid" : "dotted"} #555` }} />
        <div style={{ borderLeft: "7px solid #555", borderTop: "5px solid transparent", borderBottom: "5px solid transparent" }} />
    </div>
);

const StartCircle = ({ status }) => (
    <div style={{ ...s.circle, background: COLORS[status].bg, color: COLORS[status].fg }}>Start</div>
);

const NodeBox = ({ step }) => {
    const c = COLORS[step.status];
    if (step.isChoice) {
        return (
            <div style={s.diamondWrap} title={step.name}>
                <div style={{ ...s.diamond, background: c.bg }} />
                <span style={{ ...s.diamondText, color: c.fg }}>Y/N</span>
                <span style={s.caption}>{step.name}</span>
            </div>
        );
    }
    return (
        <div style={{ ...s.box, background: c.bg, color: c.fg, outline: step.branch ? "2px dashed #555" : "none" }} title={step.name}>
            {step.name}
        </div>
    );
};

const EndDoc = ({ status, label }) => {
    const c = COLORS[status];
    return (
        <div style={{ ...s.doc, background: status === "pending" ? "#eee" : c.bg, color: status === "pending" ? "#777" : c.fg }}>
            {label}
            <span style={s.docFold} />
        </div>
    );
};

// ---------- pesan status ----------
function buildMessage(data, docStatus) {
    const { process, steps } = data;
    if (!process) return "Dokumen belum masuk ke workflow (belum diajukan).";
    const wfState = process.WFState?.id ?? process.WFState;
    const aborted = steps.find((x) => x.status === "aborted");
    const current = [...steps].reverse().find((x) => x.status === "current");

    if (wfState === "CC") return "Workflow selesai — dokumen telah disetujui dan diproses.";
    if (aborted || ["CA", "CT"].includes(wfState)) {
        return `Workflow dihentikan${aborted ? ` pada langkah "${aborted.name}"` : ""}${aborted?.actor ? ` oleh ${aborted.actor}` : ""}.`;
    }
    if (current) {
        const who = current.responsible || current.actor;
        return current.isChoice
            ? `Document menunggu persetujuan dari ${who || "Approver"}`
            : `Dokumen sedang di langkah "${current.name}"${who ? ` (${who})` : ""}`;
    }
    return docStatus === "DR" ? "Dokumen belum diajukan." : "Status workflow tidak diketahui.";
}

// ---------- modal ----------
export const WorkflowProgressModal = ({ open, onClose, tableName, tableId, recordId, docStatus, targetStatus = "CO", fallbackWorkflowId, title = "Workflow Activity Progress" }) => {
    const { loading, error, data, reload } = useWorkflowProgress({
        tableName, tableId, recordId, fallbackWorkflowId, enabled: open,
    });
    if (!open) return null;

    const startStatus = data?.process ? "done" : "pending";
    const wfState     = data?.process?.WFState?.id ?? data?.process?.WFState;
    const endStatus   = wfState === "CC" ? "done" : ["CA", "CT"].includes(wfState) || docStatus === "NA" ? "aborted" : "pending";
    const endLabel    = endStatus === "aborted" && docStatus ? docStatus : targetStatus;

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                <div style={s.header}>
                    <span>{title}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button style={s.iconBtn} onClick={reload} title="Refresh">↻</button>
                        <button style={s.closeBtn} onClick={onClose}>✕</button>
                    </div>
                </div>

                <div style={s.body}>
                    {loading && <p>Memuat progress workflow...</p>}
                    {error && <p style={{ color: "#8b0000" }}>Gagal memuat: {error}</p>}

                    {data && !loading && (
                        <>
                            {data.workflowName && <div style={s.wfName}>Workflow: {data.workflowName}</div>}

                            {/* Grafik */}
                            <div style={s.flowRow}>
                                <StartCircle status={startStatus} />
                                {data.steps.map((st, i) => (
                                    <React.Fragment key={st.id}>
                                        <Connector active={st.status !== "pending"} />
                                        <NodeBox step={st} />
                                    </React.Fragment>
                                ))}
                                <Connector active={endStatus !== "pending"} />
                                <EndDoc status={endStatus} label={endLabel} />
                            </div>

                            <p style={s.message}>{buildMessage(data, docStatus)}</p>

                            {/* Perbandingan definisi workflow vs aktivitas */}
                            {data.steps.length > 0 && (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={s.table}>
                                        <thead>
                                            <tr>
                                                <th style={s.th}>#</th>
                                                <th style={s.th}>Langkah (Workflow)</th>
                                                <th style={s.th}>Status Activity</th>
                                                <th style={s.th}>Responsible / Oleh</th>
                                                <th style={s.th}>Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.steps.map((st, i) => (
                                                <tr key={st.id}>
                                                    <td style={s.td}>{i + 1}</td>
                                                    <td style={s.td}>{st.name}{st.branch ? " (cabang)" : ""}</td>
                                                    <td style={s.td}>
                                                        <span style={{ ...s.pill, background: COLORS[st.status].bg, color: COLORS[st.status].fg }}>
                                                            {STATUS_TEXT[st.status]}
                                                        </span>
                                                    </td>
                                                    <td style={s.td}>{st.actor || st.responsible || "-"}</td>
                                                    <td style={s.td}>{fmtTime(st.time)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- tombol siap pakai di List mana pun ----------
export const WorkflowProgressButton = ({ buttonStyle, label = "🔀 Progress", disabled, ...modalProps }) => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                disabled={disabled}
                style={{ ...s.btn, ...buttonStyle }}
                title="Lihat progress approval workflow"
            >
                {label}
            </button>
            <WorkflowProgressModal open={open} onClose={() => setOpen(false)} {...modalProps} />
        </>
    );
};

const s = {
    btn: { background: "#6a1b9a", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontWeight: "bold", fontSize: 12, cursor: "pointer" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 },
    modal: { background: "#fcfbfb", width: "min(900px, 100%)", maxHeight: "90vh", overflow: "auto", borderRadius: 4, boxShadow: "0 8px 30px rgba(0,0,0,.35)" },
    header: { background: "#cfcfcf", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18 },
    closeBtn: { width: 36, height: 36, borderRadius: "50%", border: "none", background: "#444", color: "#fff", cursor: "pointer", fontSize: 16 },
    iconBtn: { width: 36, height: 36, borderRadius: "50%", border: "none", background: "#777", color: "#fff", cursor: "pointer", fontSize: 18 },
    body: { padding: "24px 28px" },
    wfName: { fontSize: 12, color: "#333", marginBottom: 12 },
    flowRow: { display: "flex", alignItems: "center", overflowX: "auto", padding: "20px 0 28px" },
    circle: { width: 68, height: 68, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flex: "0 0 auto" },
    box: { minWidth: 120, padding: "14px 16px", borderRadius: 10, textAlign: "center", fontSize: 17, flex: "0 0 auto", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    diamondWrap: { position: "relative", width: 70, height: 70, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" },
    diamond: { position: "absolute", width: 50, height: 50, transform: "rotate(45deg)", borderRadius: 3 },
    diamondText: { position: "relative", fontSize: 16 },
    caption: { position: "absolute", top: "100%", marginTop: 6, fontSize: 11, color: "#333", whiteSpace: "nowrap" },
    doc: { position: "relative", width: 48, height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flex: "0 0 auto", borderRadius: 2 },
    docFold: { position: "absolute", top: 0, right: 0, borderTop: "14px solid #777", borderLeft: "14px solid #b3b3b3" },
    message: { fontSize: 17, margin: "8px 0 20px", color: "#000" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#e6e6e6" },
    th: { textAlign: "left", padding: "8px 10px", background: "#999", color: "#fff" },
    td: { padding: "8px 10px", borderBottom: "1px solid #bbb" },
    pill: { padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: "bold" },
};
