// Quantumult X：手动清除小红书缓存。不发送网络请求。
// 仅删除下列四个缓存键；保留图片画质设置及其他脚本数据。
// 建议先退出小红书，避免清除过程中缓存被重写脚本重新写入。
const entries = [
  ["普通视频", "redBookVideoFeed"],
  ["图片与实况", "fmz200.xiaohongshu.feed.rsp"],
  ["评论实况", "fmz200.xiaohongshu.comments.rsp"],
  ["评论视频", "fmz200.xiaohongshu.comments.videos.rsp"]
];

const summary = [];
let removed = 0;
let failures = 0;
for (const [label, key] of entries) {
  try {
    if ($prefs.valueForKey(key) == null) {
      summary.push(label + "：原本不存在");
      continue;
    }
    $prefs.removeValueForKey(key);
    if ($prefs.valueForKey(key) == null) {
      removed++;
      summary.push(label + "：已清除");
    } else {
      failures++;
      summary.push(label + "：仍有数据，清除失败或已重新写入");
    }
  } catch (_) {
    failures++;
    summary.push(label + "：操作失败");
  }
}
console.log(summary.join("\n"));
try {
  $notify(
    "小红书缓存清除",
    failures ? "部分未清除，请查看执行日志" : "完成，本次清除 " + removed + " 项",
    summary.join("\n")
  );
} finally {
  $done();
}
