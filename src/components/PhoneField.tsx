"use client";

import {
  formatPhoneInputMask,
  isValidKzPhone,
  parsePhoneInput,
} from "@/lib/phone";

type Props = {
  id?: string;
  value: string;
  onChange: (canonicalDigits: string) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
};

/**
 * Phone field with neurokids-style mask: +7 705 111 22 40.
 * `value` / `onChange` use canonical digits (77051112240).
 */
export function PhoneField({
  id = "phone",
  value,
  onChange,
  label = "Телефон для оплаты",
  hint,
  required = true,
  className,
  inputClassName,
}: Props) {
  const display = formatPhoneInputMask(value);

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        placeholder="+7 705 111 22 40"
        value={display === "+7" ? "+7 " : display}
        onChange={(e) => onChange(parsePhoneInput(e.target.value))}
        aria-invalid={value.length > 0 && !isValidKzPhone(value)}
        className={
          inputClassName ??
          "mt-1 h-11 w-full rounded-brand border border-[var(--color-border)] bg-white px-3 text-sm"
        }
      />
      {hint ? (
        <p className="mt-1 min-h-[2.5rem] text-xs leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
