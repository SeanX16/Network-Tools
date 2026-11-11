// Quantumult X：手动查看小红书缓存。只读，不发送网络请求。
// 详情见执行日志，通知仅显示各项状态和字符数。
const entries = [
  ["普通视频", "redBookVideoFeed"],
  ["图片与实况", "fmz200.xiaohongshu.feed.rsp"],
  ["评论实况", "fmz200.xiaohongshu.comments.rsp"],
  ["评论视频", "fmz200.xiaohongshu.comments.videos.rsp"]
];

const summary = [];
let failures = 0;
for (const [label, key] of entries) {
  try {
    const raw = $prefs.valueForKey(key);
    console.log("\n【" + label + "】" + key);
    if (raw == null) {
      summary.push(label + "：暂无缓存");
      console.log("暂无缓存");
      continue;
    }
    summary.push(label + "：" + raw.length + " 字符");
    let display = raw;
    try {
      display = JSON.stringify(JSON.parse(raw), null, 2);
    } catch (_) {
      // 非 JSON 数据仍按原文展示。
    }
    console.log(display);
  } catch (_) {
    failures++;
    summary.push(label + "：读取失败");
    console.log(label + "：读取失败");
  }
}
console.log("\n" + summary.join("\n"));
try {
  $notify("小红书缓存查看", failures ? "部分读取失败，请查看执行日志" : "详情见执行日志", summary.join("\n"));
} finally {
  $done();
}
