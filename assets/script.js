(function () {
  const form = document.getElementById('qrForm');
  const urlInput = document.getElementById('urlInput');
  const sizeSelect = document.getElementById('sizeSelect');
  const errorMsg = document.getElementById('errorMsg');
  const canvas = document.getElementById('qrCanvas');
  const img = document.getElementById('qrImg');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');

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

    // Use the embedded QRGenerator library
    try {
      if (typeof QRGenerator === 'undefined') {
        throw new Error('QR generator not loaded');
      }

      QRGenerator.toCanvas(canvas, value, {
        size: size,
        margin: 4,
        dark: '#000000',
        light: '#ffffff'
      });
      
      enableDownload();
    } catch (err) {
      console.error(err);
      errorMsg.textContent = 'Failed to generate the QR code.';
      disableDownload();
    }
  });
})();
