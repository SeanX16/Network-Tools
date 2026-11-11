// 小红书视频信息流：从抓包中确认兼容的 MP4 类型里选择画质最高的一份。
const streamTypes = {
  h265: { codec: "hevc", types: new Set([533, 616, 618]), preference: 1 },
  h264: { codec: "h264", types: new Set([258]), preference: 0 }
};

function chooseStream(streams) {
  const candidates = [];
  for (const [key, { codec, types, preference }] of Object.entries(streamTypes)) {
    const variants = streams[key];
    if (!Array.isArray(variants)) continue;

    for (const stream of variants) {
      if (!stream || !types.has(stream.stream_type) || stream.video_codec !== codec ||
          stream.format !== "mp4" || stream.audio_codec !== "aac" ||
          typeof stream.master_url !== "string" || !/^https?:\/\//i.test(stream.master_url) ||
          !Number.isFinite(stream.width) || !Number.isFinite(stream.height) ||
          stream.width <= 0 || stream.height <= 0) continue;

      candidates.push({ key, preference, stream });
    }
  }

  candidates.sort((a, b) =>
    b.stream.width * b.stream.height - a.stream.width * a.stream.height ||
    b.preference - a.preference ||
    (b.stream.avg_bitrate || 0) - (a.stream.avg_bitrate || 0)
  );
  return candidates[0];
}

function rewriteNote(note) {
  const saveConfig = note?.media_save_config;
  const media = note?.video_info_v2?.media;
  if (saveConfig?.disable_save !== false || media?.video?.drm_type !== 0 || !media.stream) return false;

  const switches = note.function_switch;
  if (Array.isArray(switches) && switches.some(
    entry => entry?.type === "video_download" && entry.enable === false
  )) return false;

  const selected = chooseStream(media.stream);
  if (!selected) return false;

  // 与已实测的单条版一样，避免 App 在保存时重新挑到不兼容的版本。
  for (const [key, variants] of Object.entries(media.stream)) {
    if (!Array.isArray(variants)) continue;
    media.stream[key] = key === selected.key ? [{ ...selected.stream, default_stream: 1 }] : [];
  }
  saveConfig.disable_watermark = true;
  return true;
}

function rewriteFeed(body) {
  const feed = JSON.parse(body);
  if (!Array.isArray(feed?.data)) return {};

  let changed = false;
  for (const note of feed.data) {
    if (rewriteNote(note)) changed = true;
  }
  return changed ? { body: JSON.stringify(feed) } : {};
}

let result = {};
try {
  if ($response.body) result = rewriteFeed($response.body);
} catch (_) {
  console.log("[小红书高清保存] 无法处理视频信息流，保留原响应");
}
$done(result);
