import React, { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";

export default function QRScanner({ onScan }) {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!scannerRef.current) return;
    const qrCodeRegionId = "qr-reader-region";
    html5QrCodeRef.current = new Html5Qrcode(qrCodeRegionId);

    html5QrCodeRef.current.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250,
      },
      (decodedText, decodedResult) => {
        if (onScan) onScan(decodedText);
        if (runningRef.current) {
          html5QrCodeRef.current.stop();
          runningRef.current = false;
        }
      },
      (errorMessage) => {
        // Optionally handle scan errors
      }
    ).then(() => {
      runningRef.current = true;
    });

    return () => {
      if (html5QrCodeRef.current && runningRef.current) {
        html5QrCodeRef.current.stop().then(() => {
          html5QrCodeRef.current.clear();
        });
        runningRef.current = false;
      }
    };
  }, [onScan]);

  // Add file input handler
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new window.Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height);
        if (code && code.data) {
          if (onScan) onScan(code.data);
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
      <div
        id="qr-reader-region"
        ref={scannerRef}
        style={{ width: 300, height: 300 }}
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
