import React from 'react';

/**
 * SearchBar
 * Props:
 *   value        string       — controlled value dari POSContainer (searchValue state)
 *   onChange     (e) => void  — handler perubahan teks (debounced di POSContainer)
 *   onKeyDown    (e) => void  — handler Enter untuk barcode / auto-add (di POSContainer)
 *   inputRef     React.ref   — ref ke <input> agar POSContainer bisa .focus() setelah scan
 *   placeholder  string       — teks placeholder (opsional, ada default)
 *   disabled     bool         — dinonaktifkan saat versionMissing
 */
const SearchBar = ({ value, onChange, onKeyDown, inputRef, placeholder, disabled }) => {
    return (
        <input
            ref={inputRef}
            type="text"
            value={value ?? ""}
            placeholder={placeholder || "Cari nama / kode produk, atau scan barcode lalu Enter..."}
            onChange={onChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            autoComplete="off"
            style={{
                width: '100%',
                padding: '10px',
                marginBottom: '12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '14px',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'text',
            }}
        />
    );
};
export default SearchBar;