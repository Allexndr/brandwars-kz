"use client";

/** Opens the browser print dialog, which is how the documents become PDFs. */
export function PrintButton({ label = "Печать / Сохранить в PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      {label}
    </button>
  );
}
