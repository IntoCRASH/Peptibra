# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [
    ("../public/brand/peptibra-logo-light-1400.png", "."),
    ("../public/brand/monthyva-wordmark.png", "."),
]
binaries = []
hiddenimports = ["webview.platforms.edgechromium"]
for package in ("webview", "clr_loader", "pythonnet"):
    package_data = collect_all(package)
    datas += package_data[0]
    binaries += package_data[1]
    hiddenimports += package_data[2]

a = Analysis(
    ["launcher.py"],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Peptibra",
    console=False,
    icon="../public/favicon-isotipo.png",
)
