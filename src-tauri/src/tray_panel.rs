//! The glass panel that opens at the tray icon.
//!
//! One window serves both looks of the prototype: the panel (left click) with
//! the voice, its speed and the two actions, and the short menu (right click)
//! with the four commands. Both are the same page; the window only changes size
//! and tells the page which look it wants.
//!
//! The window is created on first use and then reused: creating a webview takes
//! a moment, and a menu that opens late feels broken. Hiding on focus loss keeps
//! the "click anywhere to dismiss" behaviour of a real popover.

use std::sync::Mutex;

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, Rect, WebviewUrl, WebviewWindowBuilder,
};

/// Which look the page should render.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Panel,
    Menu,
}

impl Mode {
    fn as_str(self) -> &'static str {
        match self {
            Mode::Panel => "panel",
            Mode::Menu => "menu",
        }
    }

    /// Logical window size: the panel is 330 wide as in the prototype, the menu
    /// only as wide as its longest row.
    fn size(self) -> (f64, f64) {
        // The page fills the window with a 6 px margin on every side, so these
        // are the sheet's own size plus that margin. Measured from the page, not
        // guessed: a taller row would clip instead of pushing the window.
        match self {
            Mode::Panel => (342.0, 308.0),
            Mode::Menu => (300.0, 222.0),
        }
    }
}

pub const EVENT: &str = "tray-panel";

/// Where the icon was when the panel opened, so a later resize can re-anchor
/// instead of growing off the screen.
static LAST_ICON: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

/// The size the page last asked for, per look. Opening the panel with the
/// design's number and then shrinking it to the page's measurement made it
/// clip for a frame and jump; the remembered size is the page's own answer, so
/// a second open starts already right.
static SIZES: Mutex<Option<((f64, f64), (f64, f64))>> = Mutex::new(None);
/// Which look is on screen, so a measurement lands in the right slot.
static CURRENT: Mutex<Option<Mode>> = Mutex::new(None);

/// Top-left corner for the window, in physical pixels.
///
/// The window sits above the tray icon and is right-aligned with it (the icon
/// lives in the corner of the screen, so the window grows to the left), then is
/// pushed back inside the monitor if that would overflow — a taskbar can be on
/// any edge.
pub fn panel_origin(
    icon: (f64, f64, f64, f64), // x, y, width, height — physical
    monitor: (i32, i32, u32, u32),
    window: (f64, f64), // physical
    gap: f64,
) -> (i32, i32) {
    let (icon_x, icon_y, icon_w, _icon_h) = icon;
    let (mon_x, mon_y, mon_w, mon_h) = monitor;
    let (win_w, win_h) = window;

    let x = icon_x + icon_w - win_w;
    // Above the icon, which is what a taskbar at the bottom needs; if that would
    // leave the monitor the window goes below it instead (taskbar at the top).
    let mut y = icon_y - win_h - gap;
    if y < mon_y as f64 {
        y = icon_y + gap;
    }

    let max_x = mon_x as f64 + mon_w as f64 - win_w - gap;
    let max_y = mon_y as f64 + mon_h as f64 - win_h - gap;
    let x = x.clamp(mon_x as f64 + gap, max_x.max(mon_x as f64 + gap));
    let y = y.clamp(mon_y as f64 + gap, max_y.max(mon_y as f64 + gap));
    (x.round() as i32, y.round() as i32)
}

/// The tray rectangle in physical pixels. Platforms report it either physical
/// or logical, so both are converted with the window's scale.
fn rect_in_physical(rect: Rect, scale: f64) -> (f64, f64, f64, f64) {
    let (x, y) = match rect.position {
        tauri::Position::Physical(position) => (position.x as f64, position.y as f64),
        tauri::Position::Logical(position) => (position.x * scale, position.y * scale),
    };
    let (width, height) = match rect.size {
        tauri::Size::Physical(size) => (size.width as f64, size.height as f64),
        tauri::Size::Logical(size) => (size.width * scale, size.height * scale),
    };
    (x, y, width, height)
}

/// Shows the window at `icon_rect` in the requested look.
pub fn show(app: &AppHandle, mode: Mode, icon_rect: Option<Rect>) {
    let window = match ensure_window(app) {
        Some(window) => window,
        None => return,
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let (logical_w, logical_h) = size_for(mode);
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: logical_w,
        height: logical_h,
    }));

    if let Some(rect) = icon_rect {
        let icon = rect_in_physical(rect, scale);
        if let Ok(mut last) = LAST_ICON.lock() {
            *last = Some(icon);
        }
        place(&window, icon, (logical_w, logical_h), scale);
    }

    if let Ok(mut current) = CURRENT.lock() {
        *current = Some(mode);
    }
    let _ = app.emit_to("tray_panel", EVENT, mode.as_str());
    let _ = window.show();
    let _ = window.set_focus();
}

/// Puts the window above the icon (or below it, when the taskbar is on top),
/// right-aligned with it and inside the monitor.
fn place(window: &tauri::WebviewWindow, icon: (f64, f64, f64, f64), size: (f64, f64), scale: f64) {
    let position = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| {
            let mon = monitor.position();
            let monitor_size = monitor.size();
            panel_origin(
                icon,
                (mon.x, mon.y, monitor_size.width, monitor_size.height),
                (size.0 * scale, size.1 * scale),
                (6.0 * scale).round(),
            )
        })
        .unwrap_or_else(|| {
            (
                (icon.0 + icon.2 - size.0 * scale) as i32,
                (icon.1 - size.1 * scale) as i32,
            )
        });
    let _ = window.set_position(tauri::Position::Physical(PhysicalPosition::new(
        position.0, position.1,
    )));
}

/// Resizes the window to the sheet the page has drawn.
///
/// The page is the only one who knows how tall the panel really is: a larger
/// system text size zooms the webview, a translation makes a label longer, and
/// the voice name can wrap. Guessing a size cut the right edge off the panel on
/// a machine with text scaling. So the page measures itself and says.
pub fn resize(app: &AppHandle, width: f64, height: f64) {
    let Some(window) = app.get_webview_window("tray_panel") else {
        return;
    };
    let mode = *CURRENT
        .lock()
        .ok()
        .and_then(|c| *c)
        .as_ref()
        .unwrap_or(&Mode::Panel);
    // A sanity clamp: a runaway measurement must not create a window bigger than
    // the screen.
    let width = width.clamp(200.0, 640.0);
    let height = height.clamp(120.0, 900.0);
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
    remember(mode, (width, height));
    // A taller panel grows upward: keep it anchored to the icon it belongs to.
    let scale = window.scale_factor().unwrap_or(1.0);
    if let Ok(last) = LAST_ICON.lock() {
        if let Some(icon) = *last {
            place(&window, icon, (width, height), scale);
        }
    }
}

/// The size to give a look: what the page measured last time, else the design.
fn size_for(mode: Mode) -> (f64, f64) {
    let stored = SIZES.lock().ok().and_then(|sizes| *sizes);
    match (stored, mode) {
        (Some((panel, _)), Mode::Panel) => panel,
        (Some((_, menu)), Mode::Menu) => menu,
        (None, mode) => mode.size(),
    }
}

/// Remembers a page measurement for its look.
fn remember(mode: Mode, size: (f64, f64)) {
    let Ok(mut sizes) = SIZES.lock() else {
        return;
    };
    let mut current = sizes.unwrap_or((Mode::Panel.size(), Mode::Menu.size()));
    match mode {
        Mode::Panel => current.0 = size,
        Mode::Menu => current.1 = size,
    }
    *sizes = Some(current);
}

/// Hides the panel; called from the page (Escape, an action picked) and when the
/// window loses focus.
pub fn hide(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("tray_panel") {
        let _ = window.hide();
    }
}

/// Whether the window exists and is on screen.
pub fn is_visible(app: &AppHandle) -> bool {
    app.get_webview_window("tray_panel")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

/// Creates the window once; every later call returns the same webview.
fn ensure_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(window) = app.get_webview_window("tray_panel") {
        return Some(window);
    }
    let (width, height) = Mode::Panel.size();
    match WebviewWindowBuilder::new(
        app,
        "tray_panel",
        WebviewUrl::App("src/traypop/index.html".into()),
    )
    .title("Tembrio")
    .inner_size(width, height)
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .visible(false)
    .build()
    {
        Ok(window) => {
            // A popover closes when you click elsewhere; the page has no way to
            // know that, so the window reports its own focus.
            let handle = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = handle.hide();
                }
            });
            Some(window)
        }
        Err(error) => {
            log::error!("Failed to create the tray panel window: {error}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::panel_origin;

    /// A taskbar at the bottom: the panel sits above the icon and grows left.
    #[test]
    fn sits_above_a_bottom_taskbar_icon() {
        let icon = (1840.0, 1060.0, 24.0, 24.0);
        let monitor = (0, 0, 1920, 1080);
        let (x, y) = panel_origin(icon, monitor, (330.0, 268.0), 6.0);
        // The panel's right edge meets the icon's right edge (1864 - 330).
        assert_eq!(x, 1534, "right-aligned with the icon");
        assert_eq!(y, 1060 - 268 - 6, "above the icon, with a small gap");
    }

    /// A taskbar at the top: there is no room above, so the panel opens below.
    #[test]
    fn flips_below_a_top_taskbar_icon() {
        let icon = (1840.0, 4.0, 24.0, 24.0);
        let monitor = (0, 0, 1920, 1080);
        let (_, y) = panel_origin(icon, monitor, (330.0, 268.0), 6.0);
        assert_eq!(y, 4 + 6, "below the icon");
    }

    /// A second monitor to the left: the panel must not drift onto the first one.
    #[test]
    fn stays_on_the_monitor_the_icon_is_on() {
        let icon = (-40.0, 1000.0, 24.0, 24.0);
        let monitor = (-1920, 0, 1920, 1080);
        let (x, _) = panel_origin(icon, monitor, (330.0, 268.0), 6.0);
        assert!(x >= -1920 + 6, "stays inside the monitor: {x}");
        assert!(x + 330 <= 0, "and on the icon's side: {x}");
    }
}
