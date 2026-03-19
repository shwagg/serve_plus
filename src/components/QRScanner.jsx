import React, { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";

export default function QRScanner({ onScan }) {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const runningRef = useRef(false);
  const initializingRef = useRef(false);
  const [error, setError] = React.useState(null);
  const [cameraStatus, setCameraStatus] = React.useState("Initializing...");

  useEffect(() => {
    if (!scannerRef.current || runningRef.current || initializingRef.current) return;
    const qrCodeRegionId = "qr-reader-region";
    // Small delay to ensure DOM is ready
    const timer = setTimeout(async () => {
      if (initializingRef.current) return;
      try {
        initializingRef.current = true;
        setCameraStatus("Requesting camera permission...");
        html5QrCodeRef.current = new Html5Qrcode(qrCodeRegionId);
        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 0.75,
          },
          (decodedText, decodedResult) => {
            (async () => {
              let position = null;
              try {
                position = await new Promise((resolve, reject) => {
                  if (!navigator.geolocation) return resolve(null);
                  const timedOut = setTimeout(() => resolve(null), 5000);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      clearTimeout(timedOut);
                      resolve(pos);
                    },
                    (err) => {
                      clearTimeout(timedOut);
                      resolve(null);
                    },
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                  );
                });
              } catch (e) {
                position = null;
              }
              if (onScan) onScan(decodedText, position);
              if (runningRef.current && html5QrCodeRef.current) {
                html5QrCodeRef.current.stop();
                runningRef.current = false;
              }
            })();
          },
          (errorMessage) => {
            // Optionally handle scan errors
          }
        );
        runningRef.current = true;
        setCameraStatus("Camera active");
        setError(null);
      } catch (err) {
        console.error("Camera error:", err);
        setError(err.message || "Failed to access camera");
        setCameraStatus("Camera failed");
        if (err.message?.includes("Permission") || err.message?.includes("NotAllowedError")) {
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (err.message?.includes("NotFound") || err.message?.includes("OverconstrainedError")) {
          setError("No camera found on this device.");
        } else {
          setError(`Camera error: ${err.message}`);
        }
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      if (html5QrCodeRef.current && runningRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current.clear();
            runningRef.current = false;
            initializingRef.current = false;
          })
          .catch((err) => {
            console.error("Error stopping scanner:", err);
            runningRef.current = false;
            initializingRef.current = false;
          });
      }
    };
  }, []);

  // Add file input handler
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new window.Image();
      img.onload = async function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        if (code && code.data) {
          // Try to get geolocation when scanning from an image (best-effort)
          let position = null;
          try {
            position = await new Promise((resolve) => {
              if (!navigator.geolocation) return resolve(null);
              const timedOut = setTimeout(() => resolve(null), 5000);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  clearTimeout(timedOut);
                  resolve(pos);
                },
                () => {
                  clearTimeout(timedOut);
                  resolve(null);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
              );
            });
          } catch (e) {
            position = null;
          }

          if (onScan) onScan(code.data, position);
        } else {
          alert("No QR code found in image.");
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {error && (
        <div style={{ 
          padding: "12px", 
          marginBottom: "16px", 
          backgroundColor: "#fee", 
          border: "1px solid #fcc",
          borderRadius: "4px",
          color: "#c00"
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ marginBottom: "8px", color: "#666", fontSize: "14px" }}>
        Status: {cameraStatus}
      </div>
      
      <div
        id="qr-reader-region"
        ref={scannerRef}
        style={{ 
          width: "100%", 
          maxWidth: 400
        }}
      />
      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 600 }}>
          Or upload QR code image:
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "block", marginTop: 8 }}
          />
        </label>
      </div>
    </div>
  );
}
