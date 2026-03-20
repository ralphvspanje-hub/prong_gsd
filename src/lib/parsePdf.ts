/** Parse a PDF file into plain text using pdfjs-dist (workerless — fine for small PDFs like resumes). */
export async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();

  // Timeout after 10s to prevent infinite hangs
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("PDF parsing timed out. Try a smaller file.")),
      10000,
    ),
  );

  const pdf = await Promise.race([
    pdfjsLib.getDocument({ data: arrayBuffer }).promise,
    timeout,
  ]);

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map((item: any) => item.str).join(" "));
  }
  return pages.join("\n\n");
}
