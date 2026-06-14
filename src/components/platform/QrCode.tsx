"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

export function QrCode({
  value,
  size = 184,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-white p-3 shadow-xl", className)}>
      <QRCodeSVG
        value={value}
        size={size}
        bgColor="#ffffff"
        fgColor="#0a0717"
        level="M"
        marginSize={0}
      />
    </div>
  );
}
