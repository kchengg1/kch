import "server-only";
import QRCode from "qrcode";
import { appConfig } from "@/app.config";

/** Public URL that the printed code points to. */
export function scanUrl(slug: string) {
  return `${appConfig.url}/q/${slug}`;
}

export function qrSvg(slug: string): Promise<string> {
  return QRCode.toString(scanUrl(slug), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });
}

export function qrPng(slug: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(scanUrl(slug), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
  });
}
