(function () {
  const form = document.getElementById('qrForm');
  const urlInput = document.getElementById('urlInput');
  const sizeSelect = document.getElementById('sizeSelect');
  const errorMsg = document.getElementById('errorMsg');
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

  function enableDownload(url) {
    downloadBtn.href = url;
    downloadBtn.removeAttribute('disabled');
  }

  function disableDownload() {
    downloadBtn.setAttribute('disabled', 'true');
    downloadBtn.href = '#';
  }

  function clearQR() {
    img.style.display = 'none';
    img.src = '';
    disableDownload();
  }

  clearBtn.addEventListener('click', () => {
    errorMsg.textContent = '';
    urlInput.value = '';
    clearQR();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.textContent = '';

    let value = urlInput.value.trim();
    const size = parseInt(sizeSelect.value, 10) || 256;

    if (!value) {
      errorMsg.textContent = 'Please enter a URL.';
      disableDownload();
      return;
    }

    // Auto-add https:// if no protocol is present
    if (!value.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
      value = 'https://' + value;
    }

    if (!isValidUrl(value)) {
      errorMsg.textContent = 'That doesn\'t look like a valid URL.';
      disableDownload();
      return;
    }

    // Use QR Server API - simple and reliable
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
    
    img.style.display = 'block';
    img.width = size;
    img.height = size;
    img.onload = () => {
      enableDownload(qrUrl);
      errorMsg.textContent = '';
    };
    img.onerror = () => {
      errorMsg.textContent = 'Failed to generate QR code. Check your internet connection.';
      disableDownload();
    };
    img.src = qrUrl;
  });
})();
