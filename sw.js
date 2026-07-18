const CACHE_NAME = "goods-shop-v2";

const PRECACHE_URLS = [
  "index.html",
  "login.html",
  "products.html",
  "product.html",
  "payment-success.html",
  "payment-fail.html",
  "mypage.html",
  "admin.html",
  "css/style.css",
  "js/supabaseClient.js",
  "js/auth.js",
  "js/config.js",
  "js/login.js",
  "js/products.js",
  "js/product.js",
  "js/payment-result.js",
  "js/mypage.js",
  "js/admin.js",
  "js/pwa.js",
  "js/install-banner.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

// Supabase(인증/DB)와 토스페이먼츠 요청은 항상 최신 상태가 필요하므로 캐시하지 않는다.
// 이 서비스 워커는 같은 출처의 정적 리소스(HTML/CSS/JS/아이콘)만 오프라인 캐시 대상으로 삼는다.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("products.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "굿즈샵", body: "새 알림이 있습니다." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "굿즈샵", {
      body: data.body ?? "",
      icon: "icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("mypage.html");
      }
    })
  );
});
