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

  async function enableDownload(url) {
    try {
      // Fetch the image and create a blob URL for proper downloading
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      downloadBtn.href = blobUrl;
      downloadBtn.removeAttribute('disabled');
    } catch (err) {
      // Fallback to direct URL if fetch fails
      downloadBtn.href = url;
      downloadBtn.removeAttribute('disabled');
    }
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

  function makeTransparent(imageUrl, bgColor, qrColor, size, callback) {
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(tempImg, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      
      const bg = hexToRgb(bgColor);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (Math.abs(r - bg.r) < 30 && Math.abs(g - bg.g) < 30 && Math.abs(b - bg.b) < 30) {
          data[i + 3] = 0;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      callback(canvas.toDataURL('image/png'));
    };
    tempImg.onerror = () => callback(imageUrl);
    tempImg.src = imageUrl;
  }
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.textContent = '';

    let value = urlInput.value.trim();
    const size = parseInt(sizeSelect.value, 10) || 256;
    const qrColor = document.getElementById('qrColor').value.replace('#', '');
    const bgColor = 'ffffff'; // Always white background
    const transparentBg = document.getElementById('transparentBg').checked;

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

    // Use QR Server API with color customization
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=${qrColor}&bgcolor=${bgColor}`;
    
    if (transparentBg) {
      makeTransparent(qrUrl, '#' + bgColor, '#' + qrColor, size, (transparentUrl) => {
        img.style.display = 'block';
        img.width = size;
        img.height = size;
        img.src = transparentUrl;
        enableDownload(transparentUrl);
        errorMsg.textContent = '';
      });
    } else {
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
    }
  });
})();
