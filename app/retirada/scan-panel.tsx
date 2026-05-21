"use client";

import { useEffect, useRef, useState } from "react";
import { validatePickupToken } from "@/app/actions";
import { FilePicker } from "@/app/file-picker";

type ScanPanelProps = {
  initialToken?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function ScanPanel({ initialToken = "" }: ScanPanelProps) {
  const [tokenValue, setTokenValue] = useState(initialToken);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isScanning) {
      return;
    }

    let cancelled = false;
    let detector: BarcodeDetectorLike | null = null;

    const stopScanner = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const scanFrame = async () => {
      if (cancelled || !videoRef.current || !detector) {
        return;
      }

      try {
        const results = await detector.detect(videoRef.current);
        const rawValue = results[0]?.rawValue?.trim();

        if (rawValue) {
          setTokenValue(rawValue);
          setIsScanning(false);
          stopScanner();
          return;
        }
      } catch (error) {
        setScannerError(error instanceof Error ? error.message : "Falha ao ler o QR pela câmera.");
        setIsScanning(false);
        stopScanner();
        return;
      }

      timeoutRef.current = window.setTimeout(() => {
        void scanFrame();
      }, 450);
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("A câmera do navegador não está disponível neste dispositivo.");
        setIsScanning(false);
        return;
      }

      if (!window.BarcodeDetector) {
        setScannerError("Este navegador não suporta leitura nativa de QR pela câmera.");
        setIsScanning(false);
        return;
      }

      detector = new window.BarcodeDetector({ formats: ["qr_code"] });

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
          <p className="authMuted">Aponte a câmera para o QR exibido no celular do morador.</p>
        </div>
      ) : null}
    </div>
  );
}
