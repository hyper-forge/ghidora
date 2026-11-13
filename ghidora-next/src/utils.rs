use std::collections::BTreeMap;
use std::io::{Cursor, Read};
use std::path::{Component, Path};

use boltffi::{data, error, export};

use flate2::{Compression, GzBuilder, read::GzDecoder};
use tar::{Archive, Builder, EntryType, Header};

// ============================================================
// SECURITY LIMITS
// ============================================================

const MAX_FILE_SIZE: usize = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE: usize = 200 * 1024 * 1024;
const MAX_ENTRIES: usize = 100_000;
const MAX_PATH_LENGTH: usize = 4096;

// ============================================================
// BOLTFFI COMPATIBLE BOUNDARY MODEL
// ============================================================

#[data]
#[derive(Debug)]
pub struct FileEntry {
    pub path: String,
    pub data: Vec<u8>,
}

// IMPORTANT:
// No BTreeMap or FileMap record crosses the FFI boundary.
// BTreeMap is used internally only.

// ============================================================
// ERRORS
// ============================================================

#[derive(Debug)]
#[error]
pub enum ArchiveError {
    InvalidPath(String),
    FileTooLarge,
    ArchiveTooLarge,
    TooManyEntries,
    InvalidArchive(String),
}

impl std::fmt::Display for ArchiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidPath(path) => write!(f, "Invalid archive path: {path}"),

            Self::FileTooLarge => write!(f, "File exceeds 50 MB"),

            Self::ArchiveTooLarge => write!(f, "Archive exceeds 200 MB"),

            Self::TooManyEntries => write!(f, "Too many archive entries"),

            Self::InvalidArchive(msg) => write!(f, "Invalid archive: {msg}"),
        }
    }
}

impl std::error::Error for ArchiveError {}

// ============================================================
// PATH VALIDATION
// ============================================================

fn validate_path(path: &str) -> Result<(), ArchiveError> {
    if path.is_empty()
        || path.len() > MAX_PATH_LENGTH
        || path.contains('\\')
        || path.contains('\0')
        || path.starts_with('/')
        || path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(ArchiveError::InvalidPath(path.to_owned()));
    }

    for component in Path::new(path).components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(ArchiveError::InvalidPath(path.to_owned()));
        }
    }

    Ok(())
}

// ============================================================
// VALIDATE INPUT FILES
// ============================================================

fn validate_files(files: &[FileEntry]) -> Result<(), ArchiveError> {
    if files.len() > MAX_ENTRIES {
        return Err(ArchiveError::TooManyEntries);
    }

    let mut total = 0usize;
    let mut previous = BTreeMap::<&str, ()>::new();

    for file in files {
        validate_path(&file.path)?;

        if previous.insert(&file.path, ()).is_some() {
            return Err(ArchiveError::InvalidArchive(format!(
                "Duplicate file path: {}",
                file.path
            )));
        }

        if file.data.len() > MAX_FILE_SIZE {
            return Err(ArchiveError::FileTooLarge);
        }

        total = total
            .checked_add(file.data.len())
            .ok_or(ArchiveError::ArchiveTooLarge)?;

        if total > MAX_TOTAL_SIZE {
            return Err(ArchiveError::ArchiveTooLarge);
        }
    }

    Ok(())
}

// ============================================================
// DETERMINISTIC FILE ORDERING
// ============================================================

fn sorted_files(files: &[FileEntry]) -> BTreeMap<&str, &[u8]> {
    let mut sorted = BTreeMap::new();

    for file in files {
        sorted.insert(file.path.as_str(), file.data.as_slice());
    }

    sorted
}

// ============================================================
// TAR HEADER
// ============================================================

fn create_header(size: usize) -> Header {
    let mut header = Header::new_gnu();

    header.set_size(size as u64);
    header.set_mode(0o644);
    header.set_entry_type(EntryType::Regular);
    header.set_mtime(0);
    header.set_uid(0);
    header.set_gid(0);
    header.set_cksum();

    header
}

// ============================================================
// TAR
// ============================================================

#[export]
pub fn tar_files_entries(files: Vec<FileEntry>) -> Result<Vec<u8>, ArchiveError> {
    validate_files(&files)?;

    let sorted = sorted_files(&files);
    let mut output = Vec::new();

    {
        let mut tar = Builder::new(&mut output);

        for (path, data) in sorted {
            let mut header = create_header(data.len());

            tar.append_data(&mut header, path, data)
                .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;
        }

        tar.finish()
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;
    }

    Ok(output)
}

// ============================================================
// TAR.GZ
// ============================================================

#[export]
pub fn targz_files_entries(files: Vec<FileEntry>) -> Result<Vec<u8>, ArchiveError> {
    validate_files(&files)?;

    let sorted = sorted_files(&files);
    let mut output = Vec::new();

    {
        let gz = GzBuilder::new()
            .mtime(0)
            .operating_system(255)
            .write(&mut output, Compression::default());

        let mut tar = Builder::new(gz);

        for (path, data) in sorted {
            let mut header = create_header(data.len());

            tar.append_data(&mut header, path, data)
                .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;
        }

        tar.finish()
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;

        let gz = tar
            .into_inner()
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;

        gz.finish()
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;
    }

    Ok(output)
}

// ============================================================
// SHARED EXTRACTION
// ============================================================

fn extract_archive<R: Read>(reader: R) -> Result<Vec<FileEntry>, ArchiveError> {
    let mut archive = Archive::new(reader);

    let mut files: BTreeMap<String, Vec<u8>> = BTreeMap::new();

    let mut total = 0usize;
    let mut count = 0usize;

    let entries = archive
        .entries()
        .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;

    for entry in entries {
        let mut entry = entry.map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;

        let entry_type = entry.header().entry_type();

        // Regular files and GNU sparse files only.
        if !entry_type.is_file() && entry_type != EntryType::GNUSparse {
            continue;
        }

        count += 1;

        if count > MAX_ENTRIES {
            return Err(ArchiveError::TooManyEntries);
        }

        let size = usize::try_from(entry.size()).map_err(|_| ArchiveError::FileTooLarge)?;

        if size > MAX_FILE_SIZE {
            return Err(ArchiveError::FileTooLarge);
        }

        total = total
            .checked_add(size)
            .ok_or(ArchiveError::ArchiveTooLarge)?;

        if total > MAX_TOTAL_SIZE {
            return Err(ArchiveError::ArchiveTooLarge);
        }

        // Own the path before mutably reading entry.
        let path = entry
            .path()
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?
            .to_str()
            .ok_or_else(|| ArchiveError::InvalidPath("Non-UTF-8 archive path".to_owned()))?
            .to_owned();

        validate_path(&path)?;

        let mut buffer = Vec::with_capacity(size);

        entry
            .read_to_end(&mut buffer)
            .map_err(|e| ArchiveError::InvalidArchive(e.to_string()))?;

        if buffer.len() != size {
            return Err(ArchiveError::InvalidArchive(
                "Entry size mismatch".to_owned(),
            ));
        }

        if files.insert(path.clone(), buffer).is_some() {
            return Err(ArchiveError::InvalidArchive(format!(
                "Duplicate archive path: {path}"
            )));
        }
    }

    // Return a BoltFFI-compatible vector.
    Ok(files
        .into_iter()
        .map(|(path, data)| FileEntry { path, data })
        .collect())
}

// ============================================================
// UNTAR
// ============================================================

#[export]
pub fn untar_files_entries(data: Vec<u8>) -> Result<Vec<FileEntry>, ArchiveError> {
    extract_archive(Cursor::new(data))
}

// ============================================================
// UNTAR.GZ
// ============================================================

#[export]
pub fn untargz_files_entries(data: Vec<u8>) -> Result<Vec<FileEntry>, ArchiveError> {
    let decoder = GzDecoder::new(Cursor::new(data));

    extract_archive(decoder)
}
