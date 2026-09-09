/* Service worker：装到桌面之后，没有网络也照样能玩。

   这里最要紧的不是「缓存什么」，而是「什么绝对不能缓存死」。
   之前踩过一次：GitHub Pages 发 cache-control: max-age=600，改完代码线上看不出变化，
   十分钟才自然过期。Service worker 是同一个坑，但没有十分钟这回事——
   cache-first 写错了就是永远，重新发布不管用，用户按刷新也不管用，
   因为请求根本走不到网络。所以两类资源分开处理：

   1. index.html —— 网络优先。它是唯一记着「现在该用哪个版本」的文件
      （style.css?v=18、app.js?v=18、词表 ?v=3 都写在它里面）。
      永远先去问网络，问不到才拿缓存顶上。这样一发布就能生效，
      离线时也还有得玩。它只有几 KB，多问一次不心疼。

   2. 带 ?v= 的静态文件 —— 缓存优先，而且可以放心。
      内容一变版本号就变，地址跟着变，等于换了一个新的缓存键，
      旧的那份再也不会被要到。这正是那套版本号的用处，这里刚好接上。

   缓存名里带版本：换名字就等于整批作废，activate 时把旧的全删掉，
   不留任何一份可能过期的东西在磁盘上。 */
const VERSION = "v18";
const CACHE = `interlock-${VERSION}`;

// 装的时候只预存外壳和简体那一套词表。繁体是另外 2MB，
// 真去切了再存——大多数人一辈子不会切，不该让所有人先下这一份。
const PRECACHE = [
  "./",
  "./style.css?v=18",
  "./app.js?v=18",
  "./sounds.js?v=3",
  "./words.js?v=3",
  "./hsk.js?v=3",
  "./glosses.js?v=3",
  "./icon-192.png",
  "./apple-touch-icon.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 少一个文件不该让整次安装失败：装不上就完全没有离线，
      // 不如先把能存的存下来，剩下的等真用到时再存。
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const isDoc = (request) =>
  request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 别人家的东西不插手

  if (isDoc(request)) {
    // 网络优先：一发布就生效，断网了才回退到缓存
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // 其余（都带着 ?v=）缓存优先：地址里有版本号，命中的一定是对的那一份
  event.respondWith(
    caches.match(request).then((hit) =>
      hit ||
      fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    ),
  );
});
