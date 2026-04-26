use blake3::Hasher;
use subtle::ConstantTimeEq;
use wasm_bindgen::prelude::*;

/* =========================
CRYPTOGRAPHY
========================= */

#[wasm_bindgen]
pub fn hash_equals(a: &[u8], b: &[u8]) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }
    let ha = hash_raw(a);
    let hb = hash_raw(b);
    ha.ct_eq(&hb).into()
}

pub fn hash_raw(input: &[u8]) -> [u8; 32] {
    let mut hasher = Hasher::new();
    hasher.update(input);
    *hasher.finalize().as_bytes()
}

/// Hash raw bytes → 32-byte BLAKE3 hash
#[wasm_bindgen]
pub fn hash_bytes(input: &[u8]) -> Vec<u8> {
    let mut hasher = Hasher::new();
    hasher.update(input);
    hasher.finalize().as_bytes().to_vec()
}
