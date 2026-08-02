// src/pages/BusinessPartnerEdit.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api/v1/models';

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// Only keep keys whose value actually changed
function buildPatch(original, edited) {
  return Object.entries(edited).reduce((acc, [key, val]) => {
    if (val !== original[key]) acc[key] = val;
    return acc;
  }, {});
}

// ---------------------------------------------------------------------------
// Sub-component: editable field row
// ---------------------------------------------------------------------------

function Field({ label, name, value, onChange, type = 'text', readOnly = false }) {
  return (
    <div className="field-row">
      <label htmlFor={name}>{label}</label>
      {readOnly ? (
        <p className="readonly-val">{value || '-'}</p>
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          className="field-input"
        />
      )}
    </div>
  );
}

function Toggle({ label, name, checked, onChange }) {
  return (
    <div className="field-row">
      <label htmlFor={name}>{label}</label>
      <label className="toggle-switch">
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={!!checked}
          onChange={onChange}
        />
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
        <span className="toggle-text">{checked ? 'Yes' : 'No'}</span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function BusinessPartnerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [originalBp, setOriginalBp] = useState(null);   // pristine copy for diff
  const [form, setForm] = useState(null);                // working copy
  const [locations, setLocations] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getHeaders();

        const [resBP, resLoc] = await Promise.all([
          fetch(`${API_BASE}/c_bpartner/${id}`, { headers }),
          fetch(
            `${API_BASE}/c_bpartner_location?$filter=C_BPartner_ID eq ${id}&$expand=C_Location_ID,M_PriceList_ID,C_PaymentTerm_ID`,
            { headers }
          ),
        ]);

        const dataBP = await resBP.json();
        const dataLoc = await resLoc.json();

        setOriginalBp(dataBP);
        setForm(dataBP);
        setLocations(dataLoc.records || []);
      } catch (err) {
        console.error('Error fetching BP detail:', err);
      }
    };

    fetchData();
  }, [id]);

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!originalBp || !form) return;
    const patch = buildPatch(originalBp, form);
    setIsDirty(Object.keys(patch).length > 0);
  }, [form, originalBp]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const handleSave = async () => {
    const patch = buildPatch(originalBp, form);
    if (!Object.keys(patch).length) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/c_bpartner/${id}`, {
        method: 'PATCH',             // IDempiere REST uses PATCH for partial update
        headers: getHeaders(),
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody['error-message'] || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      setOriginalBp(updated);        // refresh pristine copy
      setForm(updated);
      setIsDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(originalBp);
    setSaveError(null);
    setSaveSuccess(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!form) {
    return (
      <div className="bpe-shell">
        <div className="bpe-loading">
          <span className="bpe-spinner" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="bpe-shell">
        {/* ── Top bar ── */}
        <div className="bpe-topbar">
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            ← Back
          </button>

          <div className="bpe-title">
            <h2>{form.Name}</h2>
            <span className="bpe-id">BP ID: {id}</span>
          </div>

          <div className="bpe-actions">
            {isDirty && (
              <button className="btn-discard" onClick={handleDiscard} disabled={saving}>
                Discard
              </button>
            )}
            <button
              className={`btn-save ${isDirty ? 'active' : ''}`}
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? <><span className="btn-spinner" /> Saving…</> : '💾 Save Changes'}
            </button>
          </div>
        </div>

        {/* ── Status bar ── */}
        {(isDirty || saveSuccess || saveError) && (
          <div className={`bpe-status ${saveError ? 'error' : saveSuccess ? 'success' : 'dirty'}`}>
            {saveError && `⚠ Save failed: ${saveError}`}
            {saveSuccess && '✓ Changes saved successfully.'}
            {!saveError && !saveSuccess && isDirty && 'You have unsaved changes.'}
          </div>
        )}

        {/* ── Sections ── */}
        <div className="bpe-grid">

          {/* General */}
          <section className="bpe-section">
            <h3>General Information</h3>
            <Field label="Search Key"   name="Value"       value={form.Value}       onChange={handleChange} />
            <Field label="Name"         name="Name"        value={form.Name}        onChange={handleChange} />
            <Field label="Tax ID"       name="TaxID"       value={form.TaxID}       onChange={handleChange} />
            <Field label="Description"  name="Description" value={form.Description} onChange={handleChange} />
          </section>

          {/* Classification */}
          <section className="bpe-section">
            <h3>Classification</h3>
            <Field label="BP Group" name="C_BP_Group_ID_Identifier" value={form.C_BP_Group_ID_Identifier} readOnly />
            <Toggle label="Vendor"   name="IsVendor"   checked={form.IsVendor}   onChange={handleChange} />
            <Toggle label="Customer" name="IsCustomer" checked={form.IsCustomer} onChange={handleChange} />
            <Toggle label="Employee" name="IsEmployee" checked={form.IsEmployee} onChange={handleChange} />
          </section>

          {/* Financials */}
          <section className="bpe-section">
            <h3>Financials</h3>
            <Field label="Price List"    name="M_PriceList_ID_Identifier"  value={form.M_PriceList_ID_Identifier}  readOnly />
            <Field label="Payment Term"  name="C_PaymentTerm_ID_Identifier" value={form.C_PaymentTerm_ID_Identifier} readOnly />
            {form.C_PaymentTerm_ID && (
              <p className="bpe-note">Net Days: {form.C_PaymentTerm_ID.NetDays}</p>
            )}
          </section>

          {/* Addresses — full width */}
          <section className="bpe-section bpe-full">
            <h3>Addresses / Locations</h3>
            {locations.length === 0 ? (
              <p className="bpe-empty">No locations found.</p>
            ) : (
              <table className="bpe-table">
                <thead>
                  <tr>
                    <th>Name / Phone</th>
                    <th>Address</th>
                    <th>Bill To</th>
                    <th>Ship To</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id}>
                      <td>
                        <strong>{loc.Name}</strong>
                        <br />
                        <small>{loc.Phone}</small>
                      </td>
                      <td>
                        <div>{loc.C_Location_ID_Identifier}</div>
                        {loc.C_Location_ID && (
                          <div className="bpe-addr-detail">
                            {loc.C_Location_ID.Address1}<br />
                            {loc.C_Location_ID.Address2 && <>{loc.C_Location_ID.Address2}<br /></>}
                            {loc.C_Location_ID.City}, {loc.C_Location_ID.Postal}
                          </div>
                        )}
                      </td>
                      <td className="bpe-center">{loc.IsBillTo ? '✅' : '—'}</td>
                      <td className="bpe-center">{loc.IsShipTo ? '✅' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = `
  /* ── Shell ── */
  .bpe-shell {
    font-family: 'Segoe UI', system-ui, sans-serif;
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 20px 60px;
    color: #1a1a2e;
  }

  /* ── Top bar ── */
  .bpe-topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .bpe-title { flex: 1; }
  .bpe-title h2 { margin: 0; font-size: 1.4rem; }
  .bpe-id { font-size: 12px; color: #888; }
  .bpe-actions { display: flex; gap: 8px; }

  /* ── Status bar ── */
  .bpe-status {
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
    font-weight: 500;
  }
  .bpe-status.dirty   { background: #fff8e1; color: #7a5900; border: 1px solid #ffe082; }
  .bpe-status.success { background: #e8f5e9; color: #1b5e20; border: 1px solid #a5d6a7; }
  .bpe-status.error   { background: #fce4ec; color: #880e4f; border: 1px solid #f48fb1; }

  /* ── Grid ── */
  .bpe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  .bpe-section {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px 24px;
  }
  .bpe-section h3 {
    margin: 0 0 16px;
    font-size: 0.95rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #4f46e5;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
  }
  .bpe-full { grid-column: 1 / -1; }

  /* ── Field row ── */
  .field-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .field-row label {
    font-size: 13px;
    color: #555;
    font-weight: 500;
  }
  .field-input {
    padding: 7px 10px;
    border: 1px solid #d1d5db;
    border-radius: 7px;
    font-size: 14px;
    background: #f9fafb;
    transition: border-color .15s, box-shadow .15s;
    width: 100%;
    box-sizing: border-box;
  }
  .field-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,.12);
    background: #fff;
  }
  .readonly-val {
    margin: 0;
    font-size: 14px;
    color: #374151;
  }

  /* ── Toggle ── */
  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .toggle-switch input { display: none; }
  .toggle-track {
    position: relative;
    width: 40px;
    height: 22px;
    background: #d1d5db;
    border-radius: 11px;
    transition: background .2s;
  }
  .toggle-switch input:checked + .toggle-track { background: #4f46e5; }
  .toggle-thumb {
    position: absolute;
    top: 3px; left: 3px;
    width: 16px; height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform .2s;
    box-shadow: 0 1px 3px rgba(0,0,0,.25);
  }
  .toggle-switch input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
  .toggle-text { font-size: 14px; color: #374151; width: 28px; }

  /* ── Buttons ── */
  .btn-ghost {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
    transition: background .15s;
    white-space: nowrap;
  }
  .btn-ghost:hover { background: #f3f4f6; }

  .btn-save {
    padding: 8px 20px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    background: #e5e7eb;
    color: #9ca3af;
    transition: background .2s, color .2s, box-shadow .2s;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .btn-save.active {
    background: #4f46e5;
    color: #fff;
    box-shadow: 0 2px 8px rgba(79,70,229,.35);
  }
  .btn-save.active:hover { background: #4338ca; }
  .btn-save:disabled:not(.active) { cursor: not-allowed; }

  .btn-discard {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #f59e0b;
    background: #fffbeb;
    color: #92400e;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background .15s;
    white-space: nowrap;
  }
  .btn-discard:hover { background: #fef3c7; }

  /* ── Spinner ── */
  .btn-spinner, .bpe-spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .6s linear infinite;
    vertical-align: middle;
  }
  .bpe-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #555;
    padding: 40px;
  }
  .bpe-spinner {
    border-color: rgba(79,70,229,.3);
    border-top-color: #4f46e5;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Table ── */
  .bpe-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .bpe-table th {
    text-align: left;
    padding: 10px 12px;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .05em;
    border-bottom: 1px solid #e5e7eb;
  }
  .bpe-table td {
    padding: 12px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }
  .bpe-table tr:last-child td { border-bottom: none; }
  .bpe-table tr:hover td { background: #fafafa; }
  .bpe-center { text-align: center; }
  .bpe-addr-detail { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .bpe-empty { color: #9ca3af; font-size: 14px; }
  .bpe-note { font-size: 12px; color: #888; margin: 4px 0 0; }
`;

export default BusinessPartnerEdit;
