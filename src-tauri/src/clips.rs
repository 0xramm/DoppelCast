use serde::Serialize;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
pub struct ClipInfo {
    name: String,
    path: String,
    modified_ms: i64,
    size_bytes: u64,
}

// Lists .mp4 recordings straight out of the save-location folder, newest
// first -- no clip database/index, the folder itself is the source of
// truth. A missing/unreadable folder just yields an empty list.
#[tauri::command]
pub fn list_clips(folder: String) -> Vec<ClipInfo> {
    let Ok(entries) = std::fs::read_dir(Path::new(&folder)) else {
        return Vec::new();
    };

    let mut clips: Vec<ClipInfo> = entries
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("mp4"))
        })
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            Some(ClipInfo {
                name: e.file_name().to_string_lossy().into_owned(),
                path: e.path().to_string_lossy().into_owned(),
                modified_ms,
                size_bytes: meta.len(),
            })
        })
        .collect();

    clips.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    clips
}
