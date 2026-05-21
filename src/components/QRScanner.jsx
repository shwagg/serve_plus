import React, { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { showToast } from "../utils/toast";
import "./QRScanner.css";

export default function QRScanner({ onScan, statusOverride }) {
  const scannerRef   = useRef(null);
  const html5QrRef   = useRef(null);
  const runningRef   = useRef(false);
  const initRef      = useRef(false);
  const scannedRef   = useRef(false);
  const fileInputRef = useRef(null);

  const [error,        setError       ] = React.useState(null);
  const [cameraStatus, setCameraStatus] = React.useState("initializing");

  useEffect(() => {
    if (!scannerRef.current || runningRef.current || initRef.current) return;

    const timer = setTimeout(async () => {
      if (initRef.current) return;
      try {
        initRef.current = true;
        setCameraStatus("loading");
        html5QrRef.current = new Html5Qrcode("qr-reader-region");
        await html5QrRef.current.start(
          { facingMode: "environment" },
          { fps: 10, aspectRatio: 1 },
          (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            (async () => {
              let position = null;
              try {
                position = await new Promise((resolve) => {
                  if (!navigator.geolocation) return resolve(null);
                  const t = setTimeout(() => resolve(null), 5000);
                  navigator.geolocation.getCurrentPosition(
                    (p) => { clearTimeout(t); resolve(p); },
                    ()  => { clearTimeout(t); resolve(null); },
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                  );
                });
              } catch { position = null; }
              if (onScan) onScan(decodedText, position);
              if (runningRef.current && html5QrRef.current) {
                html5QrRef.current.stop();
                runningRef.current = false;
              }
            })();
          },
          () => {}
        );
        runningRef.current = true;
        setCameraStatus("active");
        setError(null);
      } catch (err) {
        setCameraStatus("error");
        if (err.message?.includes("Permission") || err.message?.includes("NotAllowedError"))
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        else if (err.message?.includes("NotFound") || err.message?.includes("OverconstrainedError"))
          setError("No camera found on this device.");
        else
          setError(`Camera error: ${err.message}`);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (html5QrRef.current && runningRef.current) {
        html5QrRef.current.stop()
          .then(() => { html5QrRef.current.clear(); runningRef.current = false; initRef.current = false; })
          .catch(() => { runningRef.current = false; initRef.current = false; });
      }
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = async () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0, img.width, img.height);
        const id   = cx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(id.data, img.width, img.height);
        if (code?.data) {
          let position = null;
          try {
            position = await new Promise((resolve) => {
              if (!navigator.geolocation) return resolve(null);
              const t = setTimeout(() => resolve(null), 5000);
              navigator.geolocation.getCurrentPosition(
                (p) => { clearTimeout(t); resolve(p); },
                ()  => { clearTimeout(t); resolve(null); },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
              );
            });
          } catch { position = null; }
          if (onScan) onScan(code.data, position);
        } else {
          showToast("No QR code found in image.");
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const statusLabel = {
    initializing: "Initializing…",
    loading:      "Requesting camera…",
    active:       "Scanning…",
    error:        "Camera unavailable",
  }[cameraStatus] ?? cameraStatus;
  const displayStatusLabel = statusOverride || statusLabel;

  return (
    <div className="qrs-wrapper">

      {/* Status row */}
      <div className="qrs-status-bar">
        <span className={`qrs-status-dot ${cameraStatus}`} />
        <span className="qrs-status-label">Status</span>
        <span className={`qrs-status-text${statusOverride ? ' qrs-status-text--success' : ''}`}>{displayStatusLabel}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="qrs-error">
          <span className="qrs-error-icon">⚠️</span>
          <span className="qrs-error-text">{error}</span>
        </div>
      )}

      {/* Viewfinder with static corner brackets */}
      <div className="qrs-viewfinder">
        <div id="qr-reader-region" ref={scannerRef} />
        <div className="qrs-corners">
          <span className="qrs-corner qrs-corner--tl" />
          <span className="qrs-corner qrs-corner--tr" />
          <span className="qrs-corner qrs-corner--br" />
          <span className="qrs-corner qrs-corner--bl" />
        </div>
      </div>

      {/* Hint */}
      <p className="qrs-hint">Point camera at the QR code</p>

      {!statusOverride && (
        <>
          {/* Divider */}
          <div className="qrs-divider">or</div>

          {/* Upload */}
          <label className="qrs-upload-btn">
            📁&nbsp; Upload QR Image
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={handleFileChange} className="qrs-upload-input" />
          </label>
        </>
      )}

    </div>
  );
}
