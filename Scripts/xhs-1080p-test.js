// Quantumult X 测试：只给「意想不到的love」提供抓包中验证过的 1080p HEVC 候选。
const noteId = "6af284ff000000001803bc5f";
const logPrefix = "[小红书 1080p 测试]";

function rewriteVideoFeed(body) {
  if (!body) return {};

  const response = JSON.parse(body);
  if (!Array.isArray(response?.data)) return {};

  const note = response.data.find(item => item?.id === noteId);
  if (!note) return {};

  const saveConfig = note.media_save_config;
  const downloadSwitches = note.function_switch;
  const downloadDisabled = Array.isArray(downloadSwitches) && downloadSwitches.some(
    entry => entry?.type === "video_download" && entry.enable === false
  );
  if (saveConfig?.disable_save !== false || downloadDisabled) {
    console.log(`${logPrefix} App 未明确允许原生保存，保留原响应`);
    return {};
  }

  const streams = note.video_info_v2?.media?.stream;
  const hevc = streams?.h265;
  const candidate = Array.isArray(hevc) && hevc.find(stream =>
    stream?.stream_type === 618 && stream.format === "mp4" &&
    stream.video_codec === "hevc" && stream.width === 1080 && stream.height === 1920 &&
    typeof stream.master_url === "string" && stream.master_url.length > 0
  );
  if (!candidate) {
    console.log(`${logPrefix} 本次未收到预期的 1080p HEVC 版本，保留原响应`);
    return {};
  }

  // 只保留这一个视频版本，以便判断 App 是否会按这份列表保存。
  for (const [codec, variants] of Object.entries(streams)) {
    if (!Array.isArray(variants)) continue;
    streams[codec] = codec === "h265" ? [{ ...candidate, default_stream: 1 }] : [];
  }
  saveConfig.disable_watermark = true;
  console.log(`${logPrefix} 已提供 1080 × 1920 HEVC，关闭保存水印`);
  return { body: JSON.stringify(response) };
}

let result = {};
try {
  result = rewriteVideoFeed($response.body);
} catch (_) {
  console.log(`${logPrefix} 无法读取视频信息流，保留原响应`);
}
$done(result);
