// 在列表页拦截所有跳转，跳过 pop 中转，直接打开目标页面
(function() {
  // 拦截 window.open 调用
  const _open = window.open;
  window.open = function(url, target, features) {
    if (url.includes('/pop?url=')) {
      const real = decodeURIComponent(url.split('url=')[1]);
      return _open.call(window, real, target, features);
    }
    return _open.call(window, url, target, features);
  };
  // 兼容直接点击 <a> 标签
  document.querySelectorAll('a[href*="/pop?url="]').forEach(a => {
    const u = a.href.split('url=')[1];
    a.href   = decodeURIComponent(u);
    a.target = '_self';
  });
})();