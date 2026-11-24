"""Peptibra Windows shell.

Business logic and data live in the web application. This executable only
shows the branded splash and opens the secure office in WebView2.
"""

from __future__ import annotations

import os
import sys
import tkinter as tk

from PIL import Image, ImageTk
import webview


APP_VERSION = "3.1.0"
OFFICE_URL = "https://www.peptibra.com/office"
SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCE_DIR = getattr(sys, "_MEIPASS", SOURCE_DIR)
LOGO_IMAGE = os.path.join(RESOURCE_DIR, "peptibra-logo-light-1400.png")
MONTHYVA_IMAGE = os.path.join(RESOURCE_DIR, "monthyva-wordmark.png")


def show_splash() -> None:
    root = tk.Tk()
    root.overrideredirect(True)
    width, height = 960, 540
    x = (root.winfo_screenwidth() - width) // 2
    y = (root.winfo_screenheight() - height) // 2
    root.geometry(f"{width}x{height}+{x}+{y}")
    canvas = tk.Canvas(root, width=width, height=height, bg="#17191c", highlightthickness=0)
    canvas.pack()
    canvas.create_oval(-180, -260, 540, 460, fill="#39101d", outline="")
    canvas.create_oval(610, 260, 1120, 760, fill="#26131a", outline="")

    try:
        logo = Image.open(LOGO_IMAGE).convert("RGBA")
        logo.thumbnail((420, 120), Image.Resampling.LANCZOS)
        root._logo = ImageTk.PhotoImage(logo)  # type: ignore[attr-defined]
        canvas.create_image(width // 2, 245, image=root._logo, anchor="center")  # type: ignore[attr-defined]
    except OSError:
        canvas.create_text(width // 2, 245, text="PEPTIBRA", fill="#ffffff", font=("Segoe UI", 34, "bold"))

    canvas.create_text(width // 2, 400, text=f"VERSIÓN {APP_VERSION}", fill="#c5cad0", font=("Segoe UI", 8, "bold"))
    try:
        monthyva = Image.open(MONTHYVA_IMAGE).convert("RGBA")
        monthyva.thumbnail((170, 48), Image.Resampling.LANCZOS)
        root._monthyva = ImageTk.PhotoImage(monthyva)  # type: ignore[attr-defined]
        canvas.create_image(width // 2, 437, image=root._monthyva, anchor="center")  # type: ignore[attr-defined]
    except OSError:
        canvas.create_text(width // 2, 437, text="Monthyva", fill="#1aa8ff", font=("Segoe UI", 16, "italic"))

    root.after(2800, root.destroy)
    root.mainloop()


def main() -> None:
    show_splash()
    profile = os.path.join(os.environ.get("LOCALAPPDATA", SOURCE_DIR), "Peptibra", "WebView2")
    os.makedirs(profile, exist_ok=True)
    webview.create_window(
        "Peptibra - Gestión de Ventas",
        OFFICE_URL,
        width=1440,
        height=900,
        min_size=(1024, 680),
        maximized=True,
        background_color="#f4f6f8",
        text_select=True,
        zoomable=True,
        confirm_close=False,
    )
    webview.start(gui="edgechromium", private_mode=False, storage_path=profile)


if __name__ == "__main__":
    main()
