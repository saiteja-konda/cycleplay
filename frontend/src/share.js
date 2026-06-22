function fmtSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

export function generateShareCard({ points, distance, movingTime, avgSpeed, date, rideName }) {
  return new Promise((resolve, reject) => {
    const W = 600, H = 500;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (points && points.length > 1) {
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const padding = 60;
      const mapW = W - padding * 2;
      const mapH = H - 180;
      const latRange = Math.max(maxLat - minLat, 0.001);
      const lngRange = Math.max(maxLng - minLng, 0.001);
      const aspect = mapW / mapH;
      let scaleX, scaleY;
      if (lngRange / latRange > aspect) {
        scaleX = mapW / lngRange;
        scaleY = scaleX;
      } else {
        scaleY = mapH / latRange;
        scaleX = scaleY;
      }
      const cx = (minLng + maxLng) / 2;
      const cy = (minLat + maxLat) / 2;

      ctx.beginPath();
      ctx.strokeStyle = '#ff6b2b';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      points.forEach((p, i) => {
        const x = (p.lng - cx) * scaleX + W / 2;
        const y = (cy - p.lat) * scaleY + (H - 160) / 2 + 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const sx = (points[0].lng - cx) * scaleX + W / 2;
      const sy = (cy - points[0].lat) * scaleY + (H - 160) / 2 + 20;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const last = points[points.length - 1];
      const ex = (last.lng - cx) * scaleX + W / 2;
      const ey = (cy - last.lat) * scaleY + (H - 160) / 2 + 20;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const statsY = H - 130;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText(`${(distance || 0).toFixed(2)} km`, W / 2, statsY);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Inter, sans-serif';
    const timeStr = movingTime ? fmtSeconds(Math.floor(movingTime)) : '0m';
    ctx.fillText(`${timeStr}  ·  ${(avgSpeed || 0).toFixed(1)} km/h avg`, W / 2, statsY + 32);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    const nameStr = rideName || 'Cycle Ride';
    const dateStr = date ? new Date(date).toLocaleDateString() : '';
    ctx.fillText(`${nameStr}  ·  ${dateStr}`, W / 2, statsY + 58);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('CyclePlay', W / 2, H - 15);

    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate image'));
    }, 'image/png');
  });
}

export async function shareRide(rideData) {
  const { points, distance, movingTime, avgSpeed, date, rideName, rideId } = rideData;
  const blob = await generateShareCard({ points, distance, movingTime, avgSpeed, date, rideName });
  const file = new File([blob], 'ride-share.png', { type: 'image/png' });
  const url = rideId
    ? `${window.location.origin}${window.location.pathname}#/ride/${rideId}`
    : window.location.href;
  const text = `I just rode ${(distance || 0).toFixed(2)} km with CyclePlay!`;

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ title: 'CyclePlay Ride', text, url, files: [file] });
  } else if (navigator.share) {
    await navigator.share({ title: 'CyclePlay Ride', text, url });
  } else {
    await navigator.clipboard.writeText(`${text} ${url}`);
    if (typeof window.showAlert === 'function') {
      window.showAlert('Copied!', 'Ride link copied to clipboard.', '📋');
    }
  }
}
