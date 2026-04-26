use std::collections::BTreeMap;
use std::io::{Cursor, Read};

use serde::Deserialize;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;

use flate2::{read::GzDecoder, Compression, GzBuilder};
use tar::{Archive, Builder, EntryType, Header};

/* =========================
LIMITS (SECURITY)
========================= */

const MAX_FILE_SIZE: usize = 50 * 1024 * 1024; // 50 MB per file
const MAX_TOTAL_SIZE: usize = 200 * 1024 * 1024; // 200 MB per archive

/* =========================
INPUT MODEL
========================= */

#[derive(Deserialize)]
pub struct FileMap {
    // path -> raw bytes
    pub files: BTreeMap<String, Vec<u8>>,
}

/* =========================
PATH VALIDATION
========================= */

fn validate_path(path: &std::path::Path) {
    if path.is_absolute() {
        panic!("absolute paths are not allowed");
    }

    if path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        panic!("parent directory traversal detected");
    }
}

/* =========================
TAR (UNCOMPRESSED)
========================= */

#[wasm_bindgen]
pub fn tar_files(files: JsValue) -> Vec<u8> {
    let FileMap { files } = from_value(files).unwrap();

    let mut total_size = 0usize;
    let mut out = Vec::new();

    {
        let mut tar = Builder::new(&mut out);

        for (path, data) in files {
            if data.len() > MAX_FILE_SIZE {
                panic!("file too large");
            }

            total_size += data.len();
            if total_size > MAX_TOTAL_SIZE {
                panic!("archive too large");
            }

            let mut header = Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_entry_type(EntryType::Regular);
            header.set_mtime(0);
            header.set_uid(0);
            header.set_gid(0);
            header.set_cksum();

            tar.append_data(&mut header, path, &data[..]).unwrap();
        }

        tar.finish().unwrap();
    }

    out
}

/* =========================
TAR.GZ (DETERMINISTIC)
========================= */

#[wasm_bindgen]
pub fn targz_files(files: JsValue) -> Vec<u8> {
    let FileMap { files } = from_value(files).unwrap();

    let mut total_size = 0usize;
    let mut out = Vec::new();

    {
        let gz = GzBuilder::new()
            .mtime(0)
            .operating_system(255) // unknown / deterministic
            .write(&mut out, Compression::default());

        let mut tar = Builder::new(gz);

        for (path, data) in files {
            if data.len() > MAX_FILE_SIZE {
                panic!("file too large");
            }

            total_size += data.len();
            if total_size > MAX_TOTAL_SIZE {
                panic!("archive too large");
            }

            let mut header = Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_entry_type(EntryType::Regular);
            header.set_mtime(0);
            header.set_uid(0);
            header.set_gid(0);
            header.set_cksum();

            tar.append_data(&mut header, path, &data[..]).unwrap();
        }

        let gz = tar.into_inner().unwrap();
        gz.finish().unwrap();
    }

    out
}

/* =========================
UNTAR
========================= */

#[wasm_bindgen]
pub fn untar_files(data: &[u8]) -> JsValue {
    let cursor = Cursor::new(data);
    let mut archive = Archive::new(cursor);

    let mut map = BTreeMap::new();
    let mut total_size = 0usize;

    for entry in archive.entries().unwrap() {
        let mut entry = entry.unwrap();

        if entry.header().entry_type() != EntryType::Regular {
            continue;
        }

        let size = entry.size() as usize; // ✅ FIX
        if size > MAX_FILE_SIZE {
            panic!("tar entry too large");
        }

        total_size += size;
        if total_size > MAX_TOTAL_SIZE {
            panic!("tar archive too large");
        }

        let path = entry.path().unwrap();
        validate_path(&path);

        let path = path.to_string_lossy().to_string();
        let mut buf = Vec::with_capacity(size);

        entry.read_to_end(&mut buf).unwrap();
        map.insert(path, buf);
    }

    to_value(&map).unwrap()
}

/* =========================
UNTAR.GZ
========================= */

#[wasm_bindgen]
pub fn untargz_files(data: &[u8]) -> JsValue {
    let gz = GzDecoder::new(Cursor::new(data));
    let mut archive = Archive::new(gz);

    let mut map = BTreeMap::new();
    let mut total_size = 0usize;

    for entry in archive.entries().unwrap() {
        let mut entry = entry.unwrap();
        let entry_type = entry.header().entry_type();

        // allow normal files + GNU/posix variants
        if !(entry_type.is_file() || entry_type == EntryType::GNUSparse) {
            continue;
        }

        // if entry.header().entry_type() != EntryType::Regular {
        //     continue;
        // }

        let size = entry.size() as usize; // ✅ FIX
        if size > MAX_FILE_SIZE {
            panic!("tar entry too large");
        }

        total_size += size;
        if total_size > MAX_TOTAL_SIZE {
            panic!("tar archive too large");
        }

        let path = entry.path().unwrap();
        validate_path(&path);

        let path = path.to_string_lossy().to_string();
        let mut buf = Vec::with_capacity(size);

        entry.read_to_end(&mut buf).unwrap();
        map.insert(path, buf);
    }

    to_value(&map).unwrap()
}
