"""Draws the tray icon set from the v5 prototype's fork glyph.

The tray icon is the Tembrio fork («камертон») with a state dot, exactly as the
prototype shows it: idle = plain fork, recording = red dot, speaking = the sound
gradient, recognising = soft dot, needs help = amber dot. Each comes in two
colours: light art for a dark taskbar and ink art for a light one.

Run from the repo root:  python dev/make-tray-icons.py
"""
import os

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src-tauri", "resources")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# The prototype's #i-fork glyph, drawn into a 64 px box.
FORK = "M6 3v6a6 6 0 0 0 12 0V3M12 15v6"
LIGHT = "#F2EEE7"  # art for a dark taskbar
INK = "#1F1B2D"  # art for a light taskbar
SOFT = "#9A93A8"
RED = "#FF6B6B"
AMBER = "#F2B25C"

VARIANTS = {
    "idle": (None, None),
    "recording": (None, RED),
    "speaking": ("GRADIENT", None),
    "transcribing": (None, SOFT),
    "idle_warning": (None, AMBER),
}

GRADIENT_DEFS = (
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    '<stop offset="0" stop-color="#8B5CF6"/>'
    '<stop offset="0.5" stop-color="#C86BD9"/>'
    '<stop offset="1" stop-color="#FF8A5C"/></linearGradient></defs>'
)


def html(ink: str, dot: str | None) -> str:
    stroke = "url(#g)" if ink == "GRADIENT" else ink
    defs = GRADIENT_DEFS if ink == "GRADIENT" else ""
    dot_svg = f'<circle cx="46" cy="46" r="8.5" fill="{dot}"/>' if dot else ""
    return f"""<!doctype html><html><body style="margin:0;background:transparent">
<svg width="64" height="64" viewBox="0 0 64 64" fill="none"
     stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  {defs}
  <g transform="translate(8 7) scale(2)"><path d="{FORK}" stroke="{stroke}" stroke-width="2.4"/></g>
  {dot_svg}
</svg></body></html>"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE)
        page = browser.new_page(viewport={"width": 64, "height": 64})
        for name, (ink_style, dot) in VARIANTS.items():
            for suffix, colour in (("", LIGHT), ("_dark", INK)):
                ink = "GRADIENT" if ink_style == "GRADIENT" else colour
                page.set_content(html(ink, dot))
                page.wait_for_timeout(60)
                path = os.path.join(OUT, f"tray_{name}{suffix}.png")
                page.screenshot(path=path, omit_background=True)
                print("wrote", os.path.basename(path))
        browser.close()


if __name__ == "__main__":
    main()
