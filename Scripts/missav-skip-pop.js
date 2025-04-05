/*
  此脚本用于将拦截代码注入到 missav.ai 返回的 HTML 中，
  用以拦截 /pop?url= 链接（广告中转），
  防止新标签页打开广告，从而实现点击直接播放视频。
*/

let body = $response.body;
if (body && /<\/body>/i.test(body)) {
  // 记录注入成功到 QX 日志，并通过通知提示
  console.log('[missav] 注入脚本成功：' + $request.url);
  $notify('missav 注入成功', '', $request.url);
  
  // 定义要注入到页面内的脚本
  const injection = `
<script>
(function(){
  // 拦截 window.open 调用，防止通过 JS 打开广告新标签页
  const _open = window.open;
  window.open = function(url, target, features) {
    if (url && url.indexOf('/pop?url=') > -1) {
      // 注意：此处的 console.log 属于页面上下文，会显示在 Safari 的开发者控制台中
      console.log('【missav】广告跳转已阻止：' + url);
      return null;
    }
    return _open.call(window, url, target, features);
  };

  // 捕获页面所有点击事件，防止用户直接点击 <a> 标签跳转到中转页
  document.addEventListener('click', function(e){
    var el = e.target;
    while(el && el !== document) {
      if (el.tagName === 'A' && el.href && el.href.indexOf('/pop?url=') > -1) {
        e.preventDefault();
        try {
          let urlObj = new URL(el.href);
          let real = urlObj.searchParams.get('url');
          if(real) {
            location.href = decodeURIComponent(real);
          }
        } catch(err) {
          console.error('missav 脚本错误：' + err);
        }
        return;
      }
      el = el.parentNode;
    }
  }, true);
})();
</script>
</body>`;
  
  // 将注入脚本插入到 </body> 之前
  body = body.replace(/<\/body>/i, injection);
}
$done({ body });
