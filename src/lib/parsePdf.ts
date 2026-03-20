/** Parse a PDF file into plain text using unpdf. */
export async function parsePdf(file: File): Promise<string> {
  const { extractText } = await import("unpdf");
  const arrayBuffer = await file.arrayBuffer();
  const { text } = await extractText(new Uint8Array(arrayBuffer));
  return text;
}
