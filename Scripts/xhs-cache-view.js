// Quantumult X：手动查看小红书缓存。只读，不发送网络请求。
// 详情见执行日志，通知显示字符数及 UTF-8 文本大小（1 KB = 1024 字节）。
const entries = [
  ["普通视频", "redBookVideoFeed"],
  ["图片与实况", "fmz200.xiaohongshu.feed.rsp"],
  ["评论实况", "fmz200.xiaohongshu.comments.rsp"],
  ["评论视频", "fmz200.xiaohongshu.comments.videos.rsp"]
];

// UTF-8 编码后的文本字节数；不依赖 QX 是否提供 TextEncoder。
// 未配对的 UTF-16 代理项按替换字符 U+FFFD 计算，与 TextEncoder 一致。
function utf8ByteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) {
      bytes++;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff &&
               i + 1 < text.length &&
               text.charCodeAt(i + 1) >= 0xdc00 &&
               text.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

const summary = [];
let totalBytes = 0;
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
    const bytes = utf8ByteLength(raw);
    totalBytes += bytes;
    summary.push(label + "：" + raw.length + " 字符 / " + (bytes / 1024).toFixed(2) + " KB");
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
summary.push((failures ? "已读取合计：" : "合计：") + (totalBytes / 1024).toFixed(2) + " KB");
console.log("\n" + summary.join("\n"));
try {
  $notify("小红书缓存查看", failures ? "部分读取失败，请查看执行日志" : "详情见执行日志", summary.join("\n"));
} finally {
  $done();
}
