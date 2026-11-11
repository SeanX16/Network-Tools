// Quantumult X 测试：只给「意想不到的love」提供抓包中验证过的 1080p HEVC 候选。
const noteId = "6af284ff000000001803bc5f";
const testName = "小红书 1080p 测试 v2";

function report(message) {
  console.log(`[${testName}] ${message}`);
  if (typeof $notify === "function") {
    $notify(testName, "", message);
  }
}

function rewriteVideoFeed(body) {
  if (!body) {
    report("规则已命中，但响应为空");
    return {};
  }

  const response = JSON.parse(body);
  if (!Array.isArray(response?.data)) {
    report("规则已命中，但响应里没有视频列表");
    return {};
  }

  const note = response.data.find(item => item?.id === noteId);
  if (!note) {
    report("规则已命中，但列表里没有这条测试视频");
    return {};
  }

  const saveConfig = note.media_save_config;
  const downloadSwitches = note.function_switch;
  const downloadDisabled = Array.isArray(downloadSwitches) && downloadSwitches.some(
    entry => entry?.type === "video_download" && entry.enable === false
  );
  if (saveConfig?.disable_save !== false || downloadDisabled) {
    report("规则已命中，但 App 未明确允许原生保存");
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
    report("规则已命中，但本次没有收到预期的 1080p HEVC 版本");
    return {};
  }

  // 只保留这一个视频版本，以便判断 App 是否会按这份列表保存。
  for (const [codec, variants] of Object.entries(streams)) {
    if (!Array.isArray(variants)) continue;
    streams[codec] = codec === "h265" ? [{ ...candidate, default_stream: 1 }] : [];
  }
  saveConfig.disable_watermark = true;
  const updatedBody = JSON.stringify(response);
  report("已改写响应：1080 × 1920 HEVC，水印关闭");
  return { body: updatedBody };
}

let result = {};
try {
  result = rewriteVideoFeed($response.body);
} catch (_) {
  report("规则已命中，但无法处理这次视频响应");
}
$done(result);
