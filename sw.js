"use strict";
var CACHE_NAME = "nutriai-app-shell-v6-dark-camera";
var SHELL = ["./", "./index.html", "./app.css", "./app.js", "./manifest.webmanifest", "./icon.svg", "./admin.html"];
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.startsWith("nutriai-app-shell-") && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  var isShell = SHELL.some(function (path) { return new URL(path, self.location.href).pathname === url.pathname; });
  if (!isShell && request.mode !== "navigate") return;
  // Prefer the new deployment, retaining the app shell for offline use.
  event.respondWith(fetch(request).then(function (response) {
    if (response.ok && response.type === "basic") {
      var copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); }));
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      if (request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    });
  }));
});
