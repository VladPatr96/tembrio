"""Draws the Tembrio app icon (window, taskbar, installer) from the prototype.

The prototype's icon is a plum rounded square with the fork in the sound
gradient — see `design/v5/index.html`, the `.app-ic.tembrio` block. This writes
a 1024 px PNG that `bunx tauri icon` turns into the whole platform set
(ico, icns, Windows Store logos, mobile).

Run from the repo root:  python dev/make-app-icon.py
"""
import os

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src-tauri", "icons", "source-1024.png")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# Exactly the prototype's icon: 64-unit art on a 1024 px canvas.
HTML = """<!doctype html><html><body style="margin:0;background:transparent">
<svg width="1024" height="1024" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset="0.5" stop-color="#C86BD9"/>
      <stop offset="1" stop-color="#FF8A5C"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="#1F1B2D"/>
  <path d="M20 15v14a12 12 0 0 0 24 0V15M32 44v7" fill="none" stroke="url(#sg)"
        stroke-width="6" stroke-linecap="round"/>
</svg></body></html>"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE)
        page = browser.new_page(viewport={"width": 1024, "height": 1024})
        page.set_content(HTML)
        page.wait_for_timeout(120)
        page.screenshot(path=OUT, omit_background=True)
        browser.close()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
