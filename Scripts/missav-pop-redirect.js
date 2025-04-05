// 当真正加载到 pop?url=… 的页面时，立即跳转到解码后的目标 URL
(function() {
  const m = location.href.match(/url=(.*)/);
  if (m && m[1]) {
    location.replace(decodeURIComponent(m[1]));
  }
})();