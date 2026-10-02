import {
  browserEvents,
  type BrowserConnection,
} from "@africacod/domain/tracking-policy";
type Queue = unknown[][] & {
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  instance?: (id: string) => Queue;
  _i?: Record<string, unknown>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
};
type MetaQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push?: MetaQueue;
};
type PixelWindow = Window & {
  fbq?: MetaQueue;
  _fbq?: MetaQueue;
  ttq?: Queue;
  TiktokAnalyticsObject?: string;
  dataLayer?: unknown[];
  __commerceTracking?: { provider: string; name: string; eventId?: string }[];
};
const sent = new Set<string>();
function script(id: string, src: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.append(s);
}
function emit(
  connections: BrowserConnection[],
  phase: "view" | "checkout",
  orderNumber?: string,
) {
  if (navigator.doNotTrack === "1") return;
  const w = window as PixelWindow;
  for (const e of browserEvents(connections, phase, orderNumber)) {
    const key = `${e.provider}:${e.settings.pixelId ?? e.settings.tagId}:${e.eventId ?? crypto.randomUUID()}:${e.name}`;
    if (sent.has(key)) continue;
    sent.add(key);
    if (e.mode === "mock") {
      (w.__commerceTracking ??= []).push({
        provider: e.provider,
        name: e.name,
        eventId: e.eventId,
      });
      continue;
    }
    try {
      if (e.provider === "meta") {
        const id = e.settings.pixelId;
        if (!w.fbq) {
          const q = ((...args: unknown[]) => {
            if (q.callMethod) q.callMethod(...args);
            else q.queue.push(args);
          }) as MetaQueue;
          q.queue = [];
          q.loaded = true;
          q.version = "2.0";
          q.push = q;
          w.fbq = q;
          w._fbq ??= q;
          script(
            "meta-pixel",
            "https://connect.facebook.net/en_US/fbevents.js",
          );
        }
        if (!sent.has(`meta-init:${id}`)) {
          w.fbq("init", id);
          sent.add(`meta-init:${id}`);
        }
        w.fbq(
          "trackSingle",
          id,
          e.name,
          {},
          e.eventId ? { eventID: e.eventId } : {},
        );
      } else if (e.provider === "tiktok") {
        const id = e.settings.pixelId;
        if (!w.ttq) {
          const q: Queue = [];
          for (const name of [
            "identify",
            "instances",
            "debug",
            "on",
            "off",
            "once",
            "ready",
            "alias",
            "group",
            "enableCookie",
            "disableCookie",
          ])
            Object.assign(q, {
              [name]: (...args: unknown[]) => q.push([name, ...args]),
            });
          q.page = (...args) => {
            q.push(["page", ...args]);
          };
          q.track = (...args) => {
            q.push(["track", ...args]);
          };
          w.ttq = q;
          w.TiktokAnalyticsObject = "ttq";
        }
        const q = w.ttq;
        q._i ??= {};
        q._t ??= {};
        q._o ??= {};
        if (!q._i[id]) {
          q._i[id] = Object.assign([], {
            _u: "https://analytics.tiktok.com/i18n/pixel/events.js",
          });
          q._t[id] = Date.now();
          q._o[id] = {};
          script(
            `tiktok-${id}`,
            `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`,
          );
        }
        q.instance ??= (pixelId: string) => {
          const instance = q._i![pixelId] as Queue;
          instance.page ??= (...args) => {
            instance.push(["page", ...args]);
          };
          instance.track ??= (...args) => {
            instance.push(["track", ...args]);
          };
          return instance;
        };
        const instance = q.instance(id);
        if (e.name === "PageView") instance.page?.();
        else instance.track?.(e.name);
      } else if (e.provider === "google-ads") {
        const id = e.settings.tagId;
        w.dataLayer ??= [];
        const gtag: (...args: unknown[]) => void = function () {
          // The official gtag bootstrap queues Arguments objects, not dataLayer event arrays.
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
        if (!document.getElementById(`google-${id}`)) {
          gtag("js", new Date());
          gtag("config", id);
          script(
            `google-${id}`,
            `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
          );
        }
        // Lead action has no monetary value. Delivered action requires a future authorized server adapter.
        gtag("event", "conversion", {
          send_to: `${id}/${e.settings.leadLabel}`,
          transaction_id: orderNumber,
        });
      }
    } catch {
      /* Ad blocking and external pixel failure cannot change checkout success. */
    }
  }
}

export function emitBrowserTracking(
  connections: BrowserConnection[],
  phase: "view" | "checkout",
  orderNumber?: string,
) {
  try {
    emit(connections, phase, orderNumber);
  } catch {
    /* Checkout success is independent of tracking. */
  }
}
