(function () {
  const form = document.getElementById('qrForm');
  const urlInput = document.getElementById('urlInput');
  const sizeSelect = document.getElementById('sizeSelect');
  const errorMsg = document.getElementById('errorMsg');
  const canvas = document.getElementById('qrCanvas');
  const img = document.getElementById('qrImg');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Attempt to load the QR code library from multiple CDNs
  async function ensureQrLibLoaded() {
    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') return true;

    const sources = [
      // Prefer local vendor copy if present
      '/assets/vendor/qrcode.min.js',
      'assets/vendor/qrcode.min.js',
      // CDNs as fallback
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
      'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
    ];

    for (const src of sources) {
      try {
        await loadScript(src);
        if (window.QRCode && typeof window.QRCode.toCanvas === 'function') return true;
      } catch (_) {
        // try next source
      }
    }
    return false;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function isValidUrl(value) {
    try {
      const u = new URL(value);
      return !!u.protocol && !!u.host;
    } catch (_) {
      return false;
    }
  }

  function setCanvasSize(size) {
    canvas.width = size;
    canvas.height = size;
  }

  function enableDownload() {
    const dataUrl = canvas.toDataURL('image/png');
    downloadBtn.href = dataUrl;
    downloadBtn.removeAttribute('disabled');
  }

  function disableDownload() {
    downloadBtn.setAttribute('disabled', 'true');
    downloadBtn.href = '#';
  }

  function clearCanvas() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    disableDownload();
    img.style.display = 'none';
    img.src = '';
  }

  clearBtn.addEventListener('click', () => {
    errorMsg.textContent = '';
    urlInput.value = '';
    clearCanvas();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';

    const value = urlInput.value.trim();
    const size = parseInt(sizeSelect.value, 10) || 256;

    if (!value) {
      errorMsg.textContent = 'Please enter a URL.';
      disableDownload();
      return;
    }

    if (!isValidUrl(value)) {
      errorMsg.textContent = 'That doesn\'t look like a valid URL.';
      disableDownload();
      return;
    }

    // Make sure QR library is available
    const libReady = await ensureQrLibLoaded();
    if (libReady) {
      try {
        setCanvasSize(size);
        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        enableDownload();
        return;
      } catch (err) {
        console.error(err);
        // fall through to image-based generation
      }
    }

    // Fallback: use Google Chart API to render QR as an image
    try {
      const apiUrl = new URL('https://chart.googleapis.com/chart');
      apiUrl.searchParams.set('cht', 'qr');
      apiUrl.searchParams.set('chs', `${size}x${size}`);
      apiUrl.searchParams.set('chld', 'M|0');
      apiUrl.searchParams.set('chl', value);

      img.style.display = 'block';
      setCanvasSize(size);
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        enableDownload();
      };
      img.onerror = () => {
        errorMsg.textContent = 'Failed to generate the QR code.';
        disableDownload();
      };
      img.src = apiUrl.toString();
    } catch (err) {
      console.error(err);
      errorMsg.textContent = 'Failed to generate the QR code.';
      disableDownload();
    }
  });
})();
