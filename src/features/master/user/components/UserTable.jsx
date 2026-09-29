// src/features/master/user/components/UserTable.jsx
import React from "react";
import styles from "./userManagement.styles";

/** Presentational: tabel user aktif + tombol aktif/nonaktif. */
const UserTable = ({ users, loading, roleNameById, togglingId, onToggleActive }) => {
    if (loading) return <p style={{ color: "#777" }}>Memuat...</p>;

    return (
        <div style={{ overflowX: "auto" }}>
            <table className="modern-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Username / Email</th>
                        <th>Role</th>
                        <th style={{ width: "140px" }}>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>
                                {u.roleIds.length === 0 ? (
                                    <span style={{ color: "#999" }}>— tanpa role —</span>
                                ) : (
                                    u.roleIds.map((rid) => (
                                        <span key={rid} style={styles.roleBadge}>
                                            {roleNameById.get(rid) || `Role #${rid}`}
                                        </span>
                                    ))
                                )}
                            </td>
                            <td>
                                <button
                                    onClick={() => onToggleActive(u)}
                                    disabled={togglingId === u.id}
                                    style={u.isActive ? styles.deactivateBtn : styles.activateBtn}
                                >
                                    {togglingId === u.id ? "..." : u.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserTable;
