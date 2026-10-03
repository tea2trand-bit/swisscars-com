// Encode UTF-8 bytes without the dependency's quoted-printable soft-break corruption.
export function mailParts(text: string, html?: string) {
  const encode = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).match(/.{1,76}/g)?.join('\r\n') || '';
  };
  return { mimeContent: [
    { mimeType: 'text/plain; charset="utf-8"', transferEncoding: 'base64', content: encode(text) },
    ...(html ? [{ mimeType: 'text/html; charset="utf-8"', transferEncoding: 'base64', content: encode(html) }] : []),
  ] };
}
