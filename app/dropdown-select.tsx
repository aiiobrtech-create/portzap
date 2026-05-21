"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownSelectProps = {
  name: string;
  options: DropdownOption[];
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  icon?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  onValueChange?: (value: string) => void;
  menuClassName?: string;
};

export function DropdownSelect({
  name,
  options,
  defaultValue = "",
  value,
  placeholder = "Selecionar...",
  icon,
  required = false,
  disabled = false,
  className,
  triggerClassName,
  onValueChange,
  menuClassName,
}: DropdownSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === currentValue) ?? null,
    [currentValue, options],
  );

  const displayLabel = selectedOption?.label ?? placeholder;

  const handleChange = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    setIsOpen(false);
    onValueChange?.(nextValue);
  };

  return (
    <div ref={rootRef} className={`dropdownField${className ? ` ${className}` : ""}`}>
      <input type="hidden" name={name} value={currentValue} required={required} />

      <button
        id={id}
        type="button"
        className={`dropdownTrigger${triggerClassName ? ` ${triggerClassName}` : ""}${disabled ? " is-disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onPointerDown={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        disabled={disabled}
      >
        {icon ? <span className="dropdownTriggerIcon">{icon}</span> : null}
        <span className={`dropdownTriggerLabel${!selectedOption ? " is-placeholder" : ""}`}>
          {displayLabel}
        </span>
        <ChevronDown size={16} className="dropdownTriggerChevron" />
      </button>

      {isOpen ? (
        <div id={`${id}-menu`} role="listbox" className={`dropdownMenu${menuClassName ? ` ${menuClassName}` : ""}`}>
          {options.map((option) => {
            const isSelected = option.value === currentValue;

            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`dropdownOption${isSelected ? " is-selected" : ""}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleChange(option.value);
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
