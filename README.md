# QR Code Web

A tiny static site to generate a QR code from a URL. Everything runs in your browser—no backend needed.

## Quick Start

- Open [index.html](index.html) in your browser, type a URL, and click "Generate QR Code".
- Optionally, change the size and download the PNG.

## Develop / Serve Locally

You can simply open [index.html](index.html). If you prefer a local server (recommended for some browsers), use one of the options below:

### Python (if installed)

```powershell
cd c:\git\QR-Code-Web
python -m http.server 5500
```

Then visit http://localhost:5500/

### Node.js (npx serve)

```powershell
cd c:\git\QR-Code-Web
npx serve -p 5500
```

Then visit http://localhost:5500/

## Files

- [index.html](index.html): Main page with form and canvas
- [assets/style.css](assets/style.css): Minimal styling
- [assets/script.js](assets/script.js): URL validation and QR generation

## Notes

- Uses the `qrcode` browser library via CDN.
- No data leaves your machine; generation is entirely client-side.
# QR-Code-Web
This is a qr code generator
