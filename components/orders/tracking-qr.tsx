"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";

type TrackingQrProps = {
  href: string;
  className?: string;
};

const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export function TrackingQr({ href, className }: TrackingQrProps) {
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getOrigin,
    getServerOrigin,
  );
  const absoluteUrl = origin ? new URL(href, origin).toString() : null;

  return (
    <div className={className}>
      {absoluteUrl ? (
        <QRCodeSVG
          aria-label="Código QR para abrir el seguimiento privado del pedido"
          level="M"
          size={160}
          value={absoluteUrl}
        />
      ) : (
        <div
          aria-label="Preparando código QR de seguimiento"
          className="h-40 w-40 animate-pulse bg-stone-100"
          role="img"
        />
      )}
      <p className="mt-2 text-center text-xs text-stone-600">
        Escanea para abrir el seguimiento privado
      </p>
    </div>
  );
}
