use boltffi::export;

// ============================================================
// BADGES
// ============================================================

#[derive(Clone, Copy, Debug)]
#[repr(u8)]
#[export]
pub enum BadgeKind {
    Success = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

#[export]
pub fn badge(label: String, kind: u8) -> String {
    match kind {
        0 => format!("\x1b[42;30m ✔ {} \x1b[0m", label),
        1 => format!("\x1b[44;37m ℹ {} \x1b[0m", label),
        2 => format!("\x1b[43;30m ⚠ {} \x1b[0m", label),
        3 => format!("\x1b[41;37m ✖ {} \x1b[0m", label),
        _ => label,
    }
}

// ============================================================
// TERMINAL CONTROL
// ============================================================

#[export]
pub fn clear() -> String {
    "\x1b[2J\x1b[H".to_owned()
}

#[export]
pub fn hide_cursor() -> String {
    "\x1b[?25l".to_owned()
}

#[export]
pub fn show_cursor() -> String {
    "\x1b[?25h".to_owned()
}

#[export]
pub fn cursor_to(row: u16, col: u16) -> String {
    format!("\x1b[{};{}H", row, col)
}

#[export]
pub fn clear_line() -> String {
    "\x1b[2K".to_owned()
}

// ============================================================
// STYLES
// ============================================================

fn rgb(r: u8, g: u8, b: u8, ch: char) -> String {
    format!("\x1b[38;2;{};{};{}m{}\x1b[0m", r, g, b, ch)
}

#[export]
pub fn gradient(text: String) -> String {
    let mut out = String::new();
    let len = text.chars().count().max(1);

    for (i, ch) in text.chars().enumerate() {
        let r = 255 - (i * 160 / len) as u8;
        let g = 80 + (i * 120 / len) as u8;

        out.push_str(&rgb(r, g, 220, ch));
    }

    out
}

// ============================================================
// UI BLOCKS
// ============================================================

#[export]
pub fn header(text: String) -> String {
    let bar = "═".repeat(text.len() + 6);

    format!("╔{b}╗\n║   {t}   ║\n╚{b}╝\n", b = bar, t = text)
}

#[export]
pub fn box_ui(title: String, body: String) -> String {
    let width = title.len().max(body.len()) + 4;

    format!(
        "┏{h}┓\n┃ {t:<w$} ┃\n┣{h}┫\n┃ {b:<w$} ┃\n┗{h}┛",
        h = "━".repeat(width),
        t = title,
        b = body,
        w = width - 2
    )
}

// ============================================================
// STATIC DASHBOARD
// ============================================================

#[export]
pub fn draw_static() -> String {
    format!(
        "{}{}{}\n{}\n{}\n{}\n\n",
        clear(),
        hide_cursor(),
        gradient("⚡ GHIDORA TUI ⚡".to_owned()),
        header("BRAHMA / WASM".to_owned()),
        box_ui("STATUS".to_owned(), "wasm-pack running".to_owned()),
        badge("no-deps".to_owned(), 2),
    )
}

// ============================================================
// SPINNER
// ============================================================

#[export]
pub fn spinner_at(frame: u32, row: u16) -> String {
    const FRAMES: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    format!(
        "{}{}{} Initializing wasm...",
        cursor_to(row, 1),
        clear_line(),
        FRAMES[(frame as usize) % FRAMES.len()]
    )
}

// ============================================================
// GHIDORA LOGO
// ============================================================

fn gold(s: &str) -> String {
    format!("\x1b[38;2;255;215;0m{}\x1b[0m", s)
}

#[export]
pub fn ghidora_logo() -> String {
    const LOGO: &str = r#"
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

    gold(LOGO)
}
