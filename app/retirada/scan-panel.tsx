"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { validatePickupToken } from "@/app/actions";
import { FilePicker } from "@/app/file-picker";

type ScanPanelProps = {
  initialToken?: string;
};

export function ScanPanel({ initialToken = "" }: ScanPanelProps) {
  const [tokenValue, setTokenValue] = useState(initialToken);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isScanning) {
      return;
    }

    let cancelled = false;

    const stopScanner = () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
        rafRef.current = window.requestAnimationFrame(() => {
          void scanFrame();
        });
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);

      if (decoded?.data) {
        setTokenValue(decoded.data.trim());
        setIsScanning(false);
        stopScanner();
        return;
      }

      rafRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("A câmera do navegador não está disponível neste dispositivo.");
        setIsScanning(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        await scanFrame();
      } catch (error) {
        setScannerError(error instanceof Error ? error.message : "Não foi possível abrir a câmera.");
        setIsScanning(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isScanning]);

  return (
    <div className="stackGrid">
      <form action={validatePickupToken} className="deliveryForm">
        <input type="hidden" name="redirectPath" value="/retirada" />
        <label className="field">
          <span>QR ou código de retirada</span>
          <input
            name="token"
            value={tokenValue}
            onChange={(event) => setTokenValue(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={512}
            placeholder="Escaneie o QR ou cole o link/código aqui"
            required
          />
        </label>

        <FilePicker name="pickupPhoto" label="Foto de prova opcional" />

        <div className="inlineFormActions">
          <button className="primaryButton" type="submit">
            Validar retirada
          </button>
          <button
            className="ghostButton"
            type="button"
            onClick={() => {
              setScannerError("");
              setIsScanning((current) => !current);
            }}
          >
            {isScanning ? "Fechar câmera" : "Ler pela câmera"}
          </button>
        </div>
      </form>

      {scannerError ? <p className="authMuted">{scannerError}</p> : null}

      {isScanning ? (
        <div className="scannerCard">
          <video ref={videoRef} className="scannerVideo" playsInline muted />
          <canvas ref={canvasRef} hidden aria-hidden="true" />
          <p className="authMuted">Aponte a câmera para o QR exibido no celular do morador.</p>
        </div>
      ) : null}
    </div>
  );
}
