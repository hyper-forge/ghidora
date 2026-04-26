use wasm_bindgen::prelude::*;

/* =========================
BADGES
========================= */

#[wasm_bindgen]
pub enum BadgeKind {
    Success,
    Info,
    Warn,
    Error,
}

#[wasm_bindgen]
pub fn badge(label: &str, kind: BadgeKind) -> String {
    match kind {
        BadgeKind::Success => format!("\x1b[42;30m ✔ {} \x1b[0m", label),
        BadgeKind::Info => format!("\x1b[44;37m ℹ {} \x1b[0m", label),
        BadgeKind::Warn => format!("\x1b[43;30m ⚠ {} \x1b[0m", label),
        BadgeKind::Error => format!("\x1b[41;37m ✖ {} \x1b[0m", label),
    }
}

/* =========================
TERMINAL CONTROL
========================= */

#[wasm_bindgen]
pub fn clear() -> String {
    "\x1b[2J\x1b[H".to_string()
}

#[wasm_bindgen]
pub fn hide_cursor() -> String {
    "\x1b[?25l".to_string()
}

#[wasm_bindgen]
pub fn show_cursor() -> String {
    "\x1b[?25h".to_string()
}

#[wasm_bindgen]
pub fn cursor_to(row: u16, col: u16) -> String {
    format!("\x1b[{};{}H", row, col)
}

#[wasm_bindgen]
pub fn clear_line() -> String {
    "\x1b[2K".to_string()
}

/* =========================
STYLES
========================= */

fn rgb(r: u8, g: u8, b: u8, ch: char) -> String {
    format!("\x1b[38;2;{};{};{}m{}\x1b[0m", r, g, b, ch)
}

#[wasm_bindgen]
pub fn gradient(text: &str) -> String {
    let mut out = String::new();
    let len = text.chars().count().max(1);

    for (i, ch) in text.chars().enumerate() {
        let r = 255 - (i * 160 / len) as u8;
        let g = 80 + (i * 120 / len) as u8;
        let b = 220;
        out.push_str(&rgb(r, g, b, ch));
    }
    out
}

/* =========================
UI BLOCKS
========================= */

#[wasm_bindgen]
pub fn header(text: &str) -> String {
    let bar = "═".repeat(text.len() + 6);
    format!("╔{b}╗\n║   {t}   ║\n╚{b}╝\n", b = bar, t = text)
}

#[wasm_bindgen]
pub fn box_ui(title: &str, body: &str) -> String {
    let width = title.len().max(body.len()) + 4;
    format!(
        "┏{h}┓\n┃ {t:<w$} ┃\n┣{h}┫\n┃ {b:<w$} ┃\n┗{h}┛",
        h = "━".repeat(width),
        t = title,
        b = body,
        w = width - 2
    )
}

/* =========================
STATIC DASHBOARD
========================= */

#[wasm_bindgen]
pub fn draw_static() -> String {
    format!(
        "{}{}{}\n{}\n{}\n{}\n\n",
        clear(),
        hide_cursor(),
        gradient("⚡ GHIDORA TUI ⚡"),
        header("BRAHMA / WASM"),
        box_ui("STATUS", "wasm-pack running"),
        badge("no-deps", BadgeKind::Warn),
    )
}

/* =========================
SPINNER (FIXED ROW)
========================= */

#[wasm_bindgen]
pub fn spinner_at(frame: u32, row: u16) -> String {
    let frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    format!(
        "{}{}{} Initializing wasm...",
        cursor_to(row, 1),
        clear_line(),
        frames[(frame as usize) % frames.len()]
    )
}

/* =========================
GHIDORA FULL-MAN ASCII (CLEAN)
========================= */

fn gold(s: &str) -> String {
    // intense lightning gold
    format!("\x1b[38;2;255;215;0m{}\x1b[0m", s)
}

#[wasm_bindgen]
pub fn ghidora_logo() -> String {
    let logo = r#"
     ⠀⠀⣠⣤⣶⣶⡞⡀⣤⣬⣴⠀⠀⢳⣶⣶⣤⣄⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣠⣾⣿⣿⣿⣿⡇⠀⢸⣿⠿⣿⡇⠀⠀⠸⣿⣿⣿⣿⣷⣦⡀⠀⠀⠀
⠀⠀⢠⡾⣫⣿⣻⣿⣽⣿⡇⠀⠈⢿⣧⡝⠟⠀⠀⢸⣿⣿⣿⣿⣿⣟⢷⣄⠀⠀
⠀⢠⣯⡾⢿⣿⣿⡿⣿⣿⣿⣆⣠⣶⣿⣿⣷⣄⣰⣿⣿⣿⣿⣿⣿⣿⢷⣽⣄⠀
⢠⣿⢋⠴⠋⣽⠋⡸⢱⣯⡿⣿⠏⣡⣿⣽⡏⠹⣿⣿⣿⡎⢣⠙⢿⡙⠳⡙⢿⠄
⣰⢣⣃⠀⠊⠀⠀⠁⠘⠏⠁⠁⠸⣶⣿⡿⢿⡄⠈⠀⠁⠃⠈⠂⠀⠑⠠⣈⡈⣧
⡏⡘⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡥⢄⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢳⢸
⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣄⣸⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢨
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀
          __    _     __                
   ____ _/ /_  (_)___/ /___  _________ _
  / __ `/ __ \/ / __  / __ \/ ___/ __ `/
 / /_/ / / / / / /_/ / /_/ / /  / /_/ /  
 \__, /_/ /_/_/\__,_/\____/_/   \__,_/  
/____/                                  
"#;

    gold(logo)
}
