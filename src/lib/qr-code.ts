/**
 * Gera um QR Code como Data URL usando a API pública do Google Charts.
 * Sem dependências externas — usa uma URL de imagem que pode ser exibida
 * diretamente em um <img> ou baixada.
 */

export function getQrCodeUrl(text: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&margin=8`;
}

export function downloadQrCode(text: string, filename: string, size = 400) {
  const url = getQrCodeUrl(text, size);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
