/** Prepara una imagen subida (logo o foto) para guardarla sin que pese de más. */

/** Achica la imagen si es más grande que `maxLado` y la devuelve como PNG o JPEG. */
export async function prepararImagen(archivo: File, maxLado: number, tipo: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Uint8Array> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  const ctx = lienzo.getContext('2d')!;
  if (tipo === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  }
  ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, tipo, 0.85));
  if (!blob) throw new Error('No se pudo leer la imagen.');
  return new Uint8Array(await blob.arrayBuffer());
}
