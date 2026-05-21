export function fireDesktopNotification(
  title: string,
  body: string,
  options?: { tag?: string; onclick?: () => void }
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const notify = () => {
    const n = new Notification(title, {
      body: body.slice(0, 160),
      tag: options?.tag,
    });
    if (options?.onclick) {
      n.onclick = options.onclick;
    }
  };

  if (Notification.permission === "granted") {
    notify();
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") notify();
    });
  }
}
