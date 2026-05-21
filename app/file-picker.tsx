"use client";

import { Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type FilePickerProps = {
  name: string;
  label: string;
  accept?: string;
};

const maxImageDimension = 1600;
const maxCompressedImageBytes = 1200 * 1024;
const initialJpegQuality = 0.82;
const minJpegQuality = 0.58;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem selecionada."));
    };
    image.src = objectUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Não foi possível comprimir a imagem."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a compressão da imagem.");
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = initialJpegQuality;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > maxCompressedImageBytes && quality > minJpegQuality) {
    quality = Math.max(minJpegQuality, quality - 0.08);
    blob = await canvasToBlob(canvas, quality);
  }

  const compressedName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${compressedName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function FilePicker({ name, label, accept = "image/*" }: FilePickerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }

    const handleSubmit = (event: SubmitEvent) => {
      if (!isCompressing) {
        return;
      }

      event.preventDefault();
      setErrorText("Aguarde a compressão da foto antes de enviar.");
    };

    form.addEventListener("submit", handleSubmit);

    return () => {
      form.removeEventListener("submit", handleSubmit);
    };
  }, [isCompressing]);

  return (
    <div className="filePicker">
      <input
        ref={inputRef}
        id={id}
        className="filePickerInput"
        type="file"
        name={name}
        accept={accept}
        onChange={async (event) => {
          const input = event.currentTarget;
          const selectedFile = input.files?.[0];

          setErrorText("");

          if (!selectedFile) {
            setFileName("");
            return;
          }

          setFileName(selectedFile.name);

          if (!selectedFile.type.startsWith("image/")) {
            return;
          }

          input.value = "";
          setIsCompressing(true);

          try {
            const compressedFile = await compressImage(selectedFile);

            if (compressedFile.size > maxCompressedImageBytes) {
              input.value = "";
              setFileName("");
              setErrorText("A foto ainda ficou pesada demais. Tente tirar a foto mais de longe ou enviar uma imagem menor.");
              return;
            }

            const files = new DataTransfer();
            files.items.add(compressedFile);
            input.files = files.files;
            setFileName(compressedFile.name);
          } catch (error) {
            input.value = "";
            setFileName("");
            setErrorText(error instanceof Error ? error.message : "Não foi possível comprimir a imagem.");
          } finally {
            setIsCompressing(false);
          }
        }}
      />

      <label className="field fileField" htmlFor={id}>
        <span>{label}</span>
        <span className="filePickerButtonRow">
          <span className="filePickerButton">
            <Upload size={16} />
            <span>Escolher foto</span>
          </span>
          <span className={`filePickerName${fileName ? " has-file" : ""}`}>
            {fileName || "Nenhum arquivo selecionado"}
          </span>
        </span>
      </label>

      {errorText ? <p className="filePickerError" role="alert">{errorText}</p> : null}
    </div>
  );
}
