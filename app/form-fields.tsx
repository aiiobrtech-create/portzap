"use client";

import type { InputHTMLAttributes } from "react";
import { formatBrazilPhone, normalizeSlugInput } from "@/lib/input-formatting";

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PhoneInput(props: BaseInputProps) {
  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete={props.autoComplete ?? "tel-national"}
      maxLength={props.maxLength ?? 15}
      onInput={(event) => {
        event.currentTarget.value = formatBrazilPhone(event.currentTarget.value);
        props.onInput?.(event);
      }}
    />
  );
}

export function SlugInput(props: BaseInputProps) {
  return (
    <input
      {...props}
      type="text"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={props.maxLength ?? 80}
      onInput={(event) => {
        event.currentTarget.value = normalizeSlugInput(event.currentTarget.value);
        props.onInput?.(event);
      }}
    />
  );
}
