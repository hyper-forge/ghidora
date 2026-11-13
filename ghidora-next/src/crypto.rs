use blake3::Hasher;
use subtle::ConstantTimeEq;

use boltffi::export;

// ============================================================
// CRYPTOGRAPHY
// ============================================================

/// Compare two inputs using constant-time hash comparison.
#[export]
pub fn hash_equals(a: Vec<u8>, b: Vec<u8>) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }

    let ha = hash_raw(&a);
    let hb = hash_raw(&b);

    bool::from(ha.ct_eq(&hb))
}

/// Hash raw bytes → 32-byte BLAKE3 hash.
pub fn hash_raw(input: &[u8]) -> [u8; 32] {
    let mut hasher = Hasher::new();

    hasher.update(input);

    *hasher.finalize().as_bytes()
}

/// Hash raw bytes → 32-byte BLAKE3 hash.
#[export]
pub fn hash_bytes(input: Vec<u8>) -> Vec<u8> {
    hash_raw(&input).to_vec()
}
