// "Download Ticket" — a PNG snapshot of the ticket card DOM node, not a
// generated PDF the way orderPdf.js is: a ticket is meant to be shown/
// scanned as an image (saved to Photos, shared), not printed as a document.
// html2canvas is dynamically imported for the same reason jsPDF is in
// orderPdf.js — its bundle is sizable, deferred until someone actually
// clicks the button rather than loaded on every confirmation-page visit.
export async function downloadTicketImage(element, filename) {
  if (!element) return;
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true });

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default downloadTicketImage;
