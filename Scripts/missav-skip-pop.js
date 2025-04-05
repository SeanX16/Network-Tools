/*
  此脚本用于将拦截代码注入到 missav.ai 返回的 HTML 中，
  用以拦截 /pop?url= 链接（广告中转），
  防止新标签页打开广告，从而实现点击直接播放视频。
*/

// 只处理 HTML 响应
let body = $response.body;
if (body && /<\/body>/i.test(body)) {
  // 在 </body> 前注入页面脚本
  body = body.replace(/<\/body>/i, `
<script>
;(function(){
  // 1) 拦截所有 window.open，阻止中转广告
  const _open = window.open;
  window.open = function(url, target, features) {
    if (url.includes('/pop?url=')) {
      console.log('missav 广告跳转已阻止:', url);
      return null;
    }
    return _open.call(window, url, target, features);
  };
  // 2) 捕获所有点击事件，阻止 <a> 弹窗
  document.addEventListener('click', function(e){
    let el = e.target;
    while(el && el !== document) {
      if (el.tagName === 'A' && el.href.includes('/pop?url=')) {
        e.preventDefault();
        // 如果需要，也可以直接跳到真实视频：
        // let real = new URL(el.href).searchParams.get('url');
        // real && (location.href = decodeURIComponent(real));
        return;
      }
      el = el.parentNode;
    }
  }, true);
})();
</script>
</body>`);
}
$done({ body });