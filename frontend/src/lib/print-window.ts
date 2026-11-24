/**
 * Prints a window whose document was just written, once it can actually be printed: after its images
 * have loaded (or failed) and the page has been laid out. Printing straight after document.write()
 * gives a blank page in Chrome, because nothing has been rendered yet. Gives up waiting after 8 s.
 */
export function printWhenReady(printWindow: Window): void {
  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // The window was closed before it could print.
    }
  };
  // One more frame after loading, so the layout is painted before the print dialog snapshots it.
  const printAfterLayout = () => setTimeout(triggerPrint, 300);

  const images = Array.from(printWindow.document.images || []);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) {
    printAfterLayout();
    return;
  }
  let remaining = pending.length;
  const onDone = () => {
    remaining -= 1;
    if (remaining <= 0) printAfterLayout();
  };
  pending.forEach((img) => {
    img.addEventListener('load', onDone, { once: true });
    img.addEventListener('error', onDone, { once: true });
  });
  setTimeout(triggerPrint, 8000);
}
