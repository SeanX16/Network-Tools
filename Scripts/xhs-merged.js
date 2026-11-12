// 小红书整合版：fmz200 原版功能 + SeanX16 高清保存修复。
// 原版：https://github.com/fmz200/wool_scripts/blob/main/Scripts/xiaohongshu/xiaohongshu.js
// 基线 blob：8b3e6927bc6ad6a8efb52e685284c683e09578d0
// 修复：https://github.com/SeanX16/Network-Tools/blob/main/Scripts/xhs-hd-save.js
// 修复基线 blob：2d264b506e2aa6ef513c976df46ed5bb21e8d8a0
// 正式整合版 v8.1：播放交给 APP 原生选流，保存支持小红书视频 CDN 域名族及最高 4K 原视频。

// 仅保存兜底：从已验证兼容的流中选一份，不删除或修改 APP 播放候选。
const compatibleStreamTypes = {
  h265: { codec: "hevc", types: new Set([86, 533, 616, 618]), preference: 1 },
  h264: { codec: "h264", types: new Set([258]), preference: 0 }
};

function chooseCompatibleSaveStream(streams) {
  const candidates = [];
  for (const [key, { codec, types, preference }] of Object.entries(compatibleStreamTypes)) {
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


/**
 * @author fmz200
 * @function 小红书去广告、净化、解除下载限制、画质增强等
 * @date 2026-06-05 16:00:00
 */

const $ = new Env('小红书');

function rewriteResponse(inputBody, originalDownloadUrl) {
const url = $request.url;
let rsp_body = inputBody;
if (!rsp_body) {
  return $done({});
}
let obj = JSON.parse(rsp_body);

if (url.includes("/search/banner_list")) {
  obj.data = {};
} 

if (url.includes("/search/hot_list")) {
  // 热搜列表
  obj.data.items = [];
}

if (url.includes("/search/hint")) {
  // 搜索栏填充词
  obj.data.hint_words = [];
}

if (url.includes("/search/trending?")) {
  // 搜索栏
  obj.data.queries = [];
  obj.data.hint_word = {};
}

if (url.includes("/search/notes?")) {
  // 搜索结果
  if (obj.data.items?.length > 0) {
    obj.data.items = obj.data.items.filter((i) => i.model_type === "note");
  }
}

if (url.includes("/system_service/config?")) {
  // 整体配置
  const item = ["app_theme", "loading_img", "splash", "store"];
  if (obj.data) {
    for (let i of item) {
      delete obj.data[i];
    }
  }
}

if (url.includes("/system_service/splash_config")) {
  // 开屏广告
  if (obj?.data?.ads_groups?.length > 0) {
    for (let i of obj.data.ads_groups) {
      i.start_time = 3818332800; // Unix 时间戳 2090-12-31 00:00:00
      i.end_time = 3818419199; // Unix 时间戳 2090-12-31 23:59:59
      if (i?.ads?.length > 0) {
        for (let ii of i.ads) {
          ii.start_time = 3818332800; // Unix 时间戳 2090-12-31 00:00:00
          ii.end_time = 3818419199; // Unix 时间戳 2090-12-31 23:59:59
        }
      }
    }
  }
}

if (url.includes("/note/imagefeed?") || url.includes("/note/feed?")) {
  console.log('打印原body：' + JSON.stringify(obj));
  // 信息流 图片
  if (obj?.data?.length > 0) {
    if (obj.data[0]?.note_list?.length > 0) {
      for (let item of obj.data[0].note_list) {
        if (item?.media_save_config) {
          // 水印开关
          item.media_save_config.disable_save = false;
          item.media_save_config.disable_watermark = true;
          item.media_save_config.disable_weibo_cover = true;
        }
        if (item?.share_info?.function_entries?.length > 0) {
          // 下载限制
          const addItem = {type: "video_download"};
          let func = item.share_info.function_entries[0];
          if (func?.type !== "video_download") {
            // 向数组开头添加对象
            item.share_info.function_entries.unshift(addItem);
          }
        }
        // 新版下载限制
        if (Array.isArray(item.function_switch)) {
          item.function_switch.forEach(item => {
            if (item?.type === 'image_download') {
              item.enable = true;
            }
          });
        }
        // 复制权限
        const options = item.note_text_press_options;
        if (Array.isArray(options)) {
          const hasCopy = options.some(item => item.key === 'copy');
          if (!hasCopy) {
            options.push({
              key: 'copy',
              extra: ''
            });
          }
        }

        // 处理帖子引用的标签
        if (item.hash_tag) {
          item.hash_tag = item.hash_tag.filter(tag => tag.type !== "interact_vote");
        }
        // 逐条笔记、逐张图片处理，避免只增强第一条笔记。
        if (Array.isArray(item.images_list)) {
          item.images_list = imageEnhance(JSON.stringify(item.images_list));
        }
      }

      const images_list = obj.data[0].note_list[0].images_list;
      // 缓存实际返回给 App 的图片信息；实况视频数据仍保留原值。
      $.setdata(JSON.stringify(images_list), "fmz200.xiaohongshu.feed.rsp");
      console.log('已存储无水印信息♻️');
    }
  }
} 

if (url.includes("/note/live_photo/save")) {
  console.log('原body：' + rsp_body);
  const rsp = $.getdata("fmz200.xiaohongshu.feed.rsp");
  console.log("读取缓存key[fmz200.xiaohongshu.feed.rsp]的值：" + rsp);
  // console.log("读取缓存val：" + rsp);
  if (rsp == null || rsp.length === 0) {
    console.log('缓存无内容，返回原body');
    $done({body: rsp_body});
  }
  const cache_body = JSON.parse(rsp);
  let new_data = [];
  for (const images of cache_body) {
    if (images.live_photo_file_id) {
      const item = {
        file_id: images.live_photo_file_id,
        video_id: images.live_photo.media.video_id,
        url: images.live_photo.media.stream.h265[0].master_url
      };
      new_data.push(item);
    }
  }
  if (obj.data.datas) {
    replaceUrlContent(obj.data.datas, new_data);
  } else {
    obj = {"code": 0, "success": true, "msg": "fmz200创建响应体成功", "data": {"datas": new_data}};
  }
  console.log('新body：' + JSON.stringify(obj));
} 

if (url.includes("/note/widgets")) {
  const item = ["cooperate_binds", "generic", "note_next_step", "widget_list"];
  if (obj?.data) {
    for (let i of item) {
      delete obj.data[i];
    }
  }
} 

if (url.includes("/v3/note/videofeed?")) {
  // 信息流 视频
  if (obj?.data?.length > 0) {
    for (let item of obj.data) {
      if (item?.media_save_config) {
        // 水印
        item.media_save_config.disable_save = false;
        item.media_save_config.disable_watermark = true;
        item.media_save_config.disable_weibo_cover = true;
      }
      if (item?.share_info?.function_entries?.length > 0) {
        // 下载限制
        const addItem = {type: "video_download"};
        let func = item.share_info.function_entries[0];
        if (func?.type !== "video_download") {
          // 向数组开头添加对象
          item.share_info.function_entries.unshift(addItem);
        }
      }
    }
  }
}

// 信息流 视频
if (url.includes("/v4/note/videofeed")) {
  let videoData = [];
  if (obj.data?.length > 0) {
    for (let item of obj.data) {
      // 强制开启权限
      if (item?.media_save_config) {
        item.media_save_config.disable_save = false;
        item.media_save_config.disable_watermark = true;
        item.media_save_config.disable_weibo_cover = true;
      }

      // 处理 function_switch (修复按钮置灰)
      if (item?.function_switch?.length > 0) {
        for (let switchItem of item.function_switch) {
          if (switchItem.type === "video_download") {
            switchItem.enable = true;
            if (switchItem.reason) delete switchItem.reason;
          }
        }
      }

      // 添加下载按钮（如果未存在）
      if (item?.share_info?.function_entries?.length > 0) {
        const hasDownload = item.share_info.function_entries.some(entry => entry.type === "video_download");
        if (!hasDownload) {
          console.log(`添加下载按钮: ${item.id}`);
          item.share_info.function_entries.push({type: "video_download"});
        }
      }

      // 播放流、默认标记和顺序原样交给 APP；兼容白名单仅供保存失败兜底。
      const media = item?.video_info_v2?.media;
      const compatible = media?.video?.drm_type === 0 && media?.stream
        ? chooseCompatibleSaveStream(media.stream) : undefined;
      const candidates = media?.video?.drm_type === 0 ? collectSaveCandidates(media?.stream) : [];
      const reference = compatible?.stream || [...candidates].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const source = originalSaveSource(item, reference);
      if (/^[a-f0-9]{24}$/i.test(item?.id || "")) {
        videoData.push({ id: item.id, url: compatible?.stream.master_url || null,
          save_cache_version: 8, save_candidates: candidates, original_save: source });
      }
    }
    // 写入本地持久化缓存
    storeSaveEntries(videoData);
    console.log(`已缓存普通视频 ${videoData.length} 条`);
  }
}

// 视频保存请求
if (url.includes("/v10/note/video/save")) {
  let videoFeed;
  try { videoFeed = JSON.parse($.getdata("redBookVideoFeed")); } catch (_) { videoFeed = null; }
  if (!Array.isArray(videoFeed)) videoFeed = [];
  if (obj.data?.note_id !== "" && videoFeed?.length > 0) {
    for (let item of videoFeed) {
      if (item.id === obj.data.note_id && freshSaveEntry(item) && item.url) {
        obj.data.download_url = item.url;
      }
    }
  }
  console.log("[原视频保存 v8.1] 收到 v10 保存响应");
  if (originalDownloadUrl && obj.data) {
    obj.data.download_url = originalDownloadUrl;
    console.log("[原视频保存 v8.1] 已替换保存地址；播放流未改动");
  } else {
    console.log("[原视频保存 v8.1] 使用兼容流或服务器保存地址");
  }
  // 解除下载限制
  if (obj.data?.disable) {
    delete obj.data.disable;
    delete obj.data.msg;
    obj.data.status = 2;
  }
}

if (url.includes("/user/followings/followfeed")) {
  // 关注页信息流 可能感兴趣的人
  if (obj?.data?.items?.length > 0) {
    // 白名单
    obj.data.items = obj.data.items.filter((i) => i?.recommend_reason === "friend_post");
  }
} 

if (url.includes("/v4/followfeed")) {
  // 关注列表
  if (obj?.data?.items?.length > 0) {
    // recommend_user 可能感兴趣的人
    obj.data.items = obj.data.items.filter((i) => !["recommend_user"].includes(i.recommend_reason));
  }
}  

if (url.includes("/recommend/user/follow_recommend")) {
  // 用户详情页 你可能感兴趣的人
  if (obj?.data?.title === "你可能感兴趣的人" && obj?.data?.rec_users?.length > 0) {
    obj.data = {};
  }
} 

if (url.includes("/v6/homefeed")) {
  if (obj?.data?.length > 0) {
    // 信息流广告
    let newItems = [];
    for (let item of obj.data) {
      if (item?.model_type === "live_v2") {
        // 信息流-直播
      } else if (item?.hasOwnProperty("ads_info")) {
        // 信息流-赞助
      } else if (item?.hasOwnProperty("card_icon")) {
        // 信息流-带货
      } else if (item?.note_attributes?.includes("goods")) {
        // 信息流-商品
      } else {
        if (item?.related_ques) {
          delete item.related_ques;
        }
        newItems.push(item);
      }
    }
    obj.data = newItems;
  }
}

// 加载评论区
if (url.includes("/api/sns/v5/note/comment/list?") || url.includes("/api/sns/v3/note/comment/sub_comments?")) {
  replaceRedIdWithFmz200(obj.data);
  let livePhotos = [];
  let commentVideos = [];
  let note_id = "";
  if (obj.data?.comments?.length > 0) {
    note_id = obj.data.comments[0].note_id;
    for (const comment of obj.data.comments) {
      // comment_type: 0-文字，2-图片/live，3-表情包，5-视频
      fixCommentType(comment);
      extractLivePhotos(comment.pictures, livePhotos, comment.id);

      // 子评论处理
      if (comment.sub_comments?.length > 0) {
        for (const sub_comment of comment.sub_comments) {
          fixCommentType(sub_comment);
          extractLivePhotos(sub_comment.pictures, livePhotos, comment.id, "_sub");
        }
      }

      // 评论视频处理 
      if (comment?.videos?.length > 0) {
        for (const video of comment.videos) {
          if (video?.video_id && video?.video_info) {
            try {
              const videoObj = JSON.parse(video.video_info);
              // 选择最佳画质
              const streams = selectBestStream(videoObj?.stream?.h265, videoObj?.stream?.h264);
              if (streams?.master_url) {
                commentVideos.push({
                  videId: video.video_id,
                  videoUrl: streams.master_url,
                  commentId: comment.id,
                  noteId: note_id,
                  width: streams.width,
                  height: streams.height,
                  bitrate: streams.video_bitrate,
                  hdr: streams.hdr_type === 1
                });
              }
            } catch (e) {
              console.log("评论视频处理出错", e);
            }
          }
        }
      }
      
    }
  }
  console.log("本次note_id：" + note_id);
  // 存储评论实况照片
  if (livePhotos.length > 0) {
    let commitsRsp;
    const commitsCache = $.getdata("fmz200.xiaohongshu.comments.rsp");
    console.log("读取缓存val：" + commitsCache);
    if (!commitsCache) {
      commitsRsp = {noteId: note_id, livePhotos: livePhotos};
    } else {
      commitsRsp = JSON.parse(commitsCache);
      console.log("缓存note_id：" + commitsRsp.noteId);
      if (commitsRsp.noteId === note_id) {
        console.log("增量数据");
        commitsRsp.livePhotos = deduplicateLivePhotos(commitsRsp.livePhotos.concat(livePhotos));
      } else {
        console.log("更换数据");
        commitsRsp = {noteId: note_id, livePhotos: livePhotos};
      }
    }
    console.log("写入缓存val：" + JSON.stringify(commitsRsp));
    $.setdata(JSON.stringify(commitsRsp), "fmz200.xiaohongshu.comments.rsp");
  }

  // 存储评论视频信息
  if (commentVideos.length > 0) {
    let videosCache;
    const commitsCache = $.getdata("fmz200.xiaohongshu.comments.videos.rsp");
    if (!commitsCache) {
      videosCache = {noteId: note_id, videos: commentVideos};
    } else {
      videosCache = JSON.parse(commitsCache);
      console.log("[commentVideos]缓存note_id：" + videosCache.noteId);
      if (videosCache.noteId === note_id) {
        console.log("[commentVideos]增量数据");
        videosCache.videos = deduplicateLivePhotos(videosCache.videos.concat(commentVideos));
      } else {
        console.log("[commentVideos]更换数据");
        videosCache = {noteId: note_id, videos: commentVideos};
      }
    }
    console.log("[commentVideos]写入缓存val：" + JSON.stringify(videosCache));
    $.setdata(JSON.stringify(videosCache), "fmz200.xiaohongshu.comments.videos.rsp");
  }
}

// 下载评论区live图/评论区视频
if (url.includes("/api/sns/v1/interaction/comment/video/download?")) {
  const commitsCache = $.getdata("fmz200.xiaohongshu.comments.rsp");
  const commitsVideoCache = $.getdata("fmz200.xiaohongshu.comments.videos.rsp");
  console.log("读取缓存val：" + commitsCache);
  console.log("目标video_id：" + obj.data.video.video_id);
  if (commitsCache) {
    let commitsRsp = JSON.parse(commitsCache);
    if (commitsRsp.livePhotos.length > 0 && obj.data?.video) {
      for (const item of commitsRsp.livePhotos) {
        // console.log("缓存video_id：" + item.videId);
        if (item.videId === obj.data.video.video_id) {
          console.log("匹配到无水印链接：" + item.videoUrl);
          obj.data.video.video_url = item.videoUrl;
          break;
        }
      }
    }
  } else if (commitsVideoCache){
    let commitsVideoRsp = JSON.parse(commitsVideoCache);
    if (commitsVideoRsp.videos.length > 0 && obj.data?.video) {
      for (const item of commitsVideoRsp.videos) {
        // console.log("缓存video_id：" + item.videId);
        if (item.videId === obj.data.video.video_id) {
          console.log("[commentVideos]匹配到无水印链接：" + item.videoUrl);
          obj.data.video.video_url = item.videoUrl;
          break;
        }
      }
    }
  } else {
    console.log(`没有[${obj.data?.video.video_id}]的无水印地址`);
  }
}

$done({body: JSON.stringify(obj)});
}

// 静态图片默认请求平台原尺寸资源，不强制转换格式或设置固定尺寸。
function imageEnhance(jsonStr) {
  if (!jsonStr) return [];

  let images;
  try {
    images = JSON.parse(jsonStr);
  } catch (_) {
    console.log("[小红书原图] 图片数据无法解析");
    return [];
  }
  if (!Array.isArray(images)) return images;

  // 显式设置其他画质值时，继续使用原版 2160 逻辑。
  const quality = $.getdata("fmz200.xiaohongshu.imageQuality") || "original";
  if (quality !== "original") return enhanceImages2160(images);

  let changed = 0;
  const result = images.map(image => {
    // 实况沿用原版画质增强与保存流程，不改它的视频地址。
    if (!image || typeof image !== "object" || Array.isArray(image) ||
        image.live_photo_file_id || image.live_photo) {
      return enhanceImages2160([image])[0];
    }

    // fileid 是资源路径，必须完整保留 notes_pre_post/ 等目录。
    // 不接收 URL、查询参数或路径跳转；无法识别时回退原版处理。
    const fileId = image.fileid;
    if (typeof fileId !== "string" ||
        !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]{16,}$/.test(fileId)) {
      return enhanceImages2160([image])[0];
    }

    const originalUrl = "https://sns-img-bd.xhscdn.com/" + fileId;
    image.url = originalUrl;
    image.url_size_large = originalUrl;
    image.original = originalUrl;
    image.need_load_original_image = true;
    if (typeof image.url_8k === "string") image.url_8k = originalUrl;
    if (image.url_multi_level && typeof image.url_multi_level === "object" &&
        !Array.isArray(image.url_multi_level)) {
      for (const key of Object.keys(image.url_multi_level)) {
        if (typeof image.url_multi_level[key] === "string") {
          image.url_multi_level[key] = originalUrl;
        }
      }
    }
    if (image.hd_img && typeof image.hd_img === "object" &&
        typeof image.hd_img.url === "string") {
      image.hd_img.url = originalUrl;
    }
    changed++;
    return image;
  });
  console.log("[小红书原图] 已切换 " + changed + "/" + images.length + " 张静态图片");
  return result;
}

// 保留上游的高像素模式，供显式画质设置、实况和未知图片结构回退使用。
function enhanceImages2160(images) {
  let jsonStr = JSON.stringify(images);
  jsonStr = jsonStr.replace(/imageView2\/2\/w\/\d+\/format/g, "imageView2/2/w/2160/format");
  jsonStr = jsonStr.replace(/imageView2\/2\/h\/\d+\/format/g, "imageView2/2/h/2160/format");
  return JSON.parse(jsonStr);
}

function replaceUrlContent(collectionA, collectionB) {
  console.log('替换无水印的URL');
  // 匹配常见视频格式（扩展名到查询参数之前的部分）
  const videoBaseRegex = /(.*\.(mp4|mov|webm|m3u8|ts|avi|mkv|flv))/i;

  collectionA.forEach(itemA => {
    const itemB = collectionB.find(itemB => itemB.file_id === itemA.file_id);
    if (itemB) {
      console.log(`file_id：${itemA.file_id}匹配到无水印链接`);
      if (itemA.url !== "") {
        const match = itemB.url.match(videoBaseRegex);
        itemA.url = match ? match[1] : itemB.url;
      } else {
        itemA.url = itemB.url;
      }
      itemA.author = "@fmz200"
    }
  });
}

function deduplicateLivePhotos(livePhotos) {
  const seen = new Map();
  livePhotos = livePhotos.filter(item => {
    if (seen.has(item.videId)) {
      return false;
    }
    seen.set(item.videId, true);
    return true;
  });
  return livePhotos;
}

function replaceRedIdWithFmz200(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(item => replaceRedIdWithFmz200(item));
  } else if (typeof obj === 'object' && obj !== null) {
    if ('red_id' in obj) {
      obj.fmz200 = obj.red_id; // 创建新属性fmz200
      delete obj.red_id; // 删除旧属性red_id
    }
    Object.keys(obj).forEach(key => {
      replaceRedIdWithFmz200(obj[key]);
    });
  }
}

/**
 * 从流列表中选择最佳流（优先 H265，降级 H264）
 * @param {Array} h265List - H265 流列表
 * @param {Array} h264List - H264 流列表
 * @returns {Object|null} - 选中的流对象或 null
 */
function selectBestStream(h265List, h264List) {
  // 排序函数：优先分辨率面积，其次平均码率
  const sortStream = (a, b) => {
    const resA = (a.width || 0) * (a.height || 0);
    const resB = (b.width || 0) * (b.height || 0);
    if (resB !== resA) return resB - resA;
    return (b.avg_bitrate || 0) - (a.avg_bitrate || 0);
  };

  const selectFromList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    const sorted = list.filter(v => !!v.master_url).sort(sortStream);
    return sorted.length > 0 ? sorted[0] : null;
  };

  return selectFromList(h265List) || selectFromList(h264List);
}

/**
 * 修复评论类型（3->2, 1->0）
 * @param {Object} comment - 评论对象
 */
function fixCommentType(comment) {
  if (comment.comment_type === 3) {
    comment.comment_type = 2;
    console.log(`修改评论类型：3->2`);
  }
  if (comment.media_source_type === 1) {
    comment.media_source_type = 0;
    console.log(`修改媒体类型：1->0`);
  }
}

/**
 * 从图片列表中提取live照片
 * @param {Array} pictures - 图片列表
 * @param {Array} livePhotos - live照片数组（会被修改）
 * @param {string} commentId - 评论ID（用于日志）
 * @param {string} prefix - 日志前缀
 */
function extractLivePhotos(pictures, livePhotos, commentId, prefix = "") {
  if (!pictures?.length > 0) return;
  console.log(`${prefix}comment_id: ` + commentId);
  for (const picture of pictures) {
    if (picture.video_id) {
      const picObj = JSON.parse(picture.video_info);
      const bestStream = selectBestStream(picObj.stream?.h265, picObj.stream?.h264);
      if (bestStream?.master_url) {
        console.log(`${prefix}video_id：` + picture.video_id);
        livePhotos.push({
          videId: picture.video_id,
          videoUrl: bestStream.master_url
        });
      }
    }
  }
}

function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `\ud83d\udd14${this.name}, \u5f00\u59cb!`) } isNode() { return "undefined" != typeof module && !!module.exports } isQuanX() { return "undefined" != typeof $task } isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon } isLoon() { return "undefined" != typeof $loon } isShadowrocket() { return "undefined" != typeof $rocket } isStash() { return "undefined" != typeof $environment && $environment["stash-version"] } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, a] = i.split("@"), n = { url: `http://${a}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), a = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(a); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { if (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) }); else if (this.isQuanX()) this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t && t.error || "UndefinedError")); else if (this.isNode()) { let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: i, statusCode: r, headers: o, rawBody: a } = t, n = s.decode(a, this.encoding); e(null, { status: i, statusCode: r, headers: o, rawBody: a, body: n }, n) }, t => { const { message: i, response: r } = t; e(i, r, r && s.decode(r.rawBody, this.encoding)) }) } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, i) }); else if (this.isQuanX()) t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t && t.error || "UndefinedError")); else if (this.isNode()) { let i = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...o } = t; this.got[s](r, o).then(t => { const { statusCode: s, statusCode: r, headers: o, rawBody: a } = t, n = i.decode(a, this.encoding); e(null, { status: s, statusCode: r, headers: o, rawBody: a, body: n }, n) }, t => { const { message: s, response: r } = t; e(s, r, r && i.decode(r.rawBody, this.encoding)) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, i = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": i } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ["", "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack) : this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log("", `\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`), this.log(), this.isSurge() || this.isQuanX() || this.isLoon() ? $done(t) : this.isNode() && process.exit(1) } }(t, e) }

// 播放候选只读；保存缓存不携带所有候选的签名 URL，只记录媒体身份和比较参数。
function collectSaveCandidates(streams) {
  const paths = new Map();
  let count = 0;
  for (const variants of Object.values(streams || {})) {
    if (!Array.isArray(variants)) continue;
    for (const stream of variants) {
      if (++count > 64) return [];
      if (!stream || ![stream.width, stream.height, stream.size].every(n => Number.isSafeInteger(n) && n > 0) ||
          !Number.isFinite(stream.duration) || stream.duration <= 0) continue;
      const urls = [stream.master_url, ...(Array.isArray(stream.backup_urls) ? stream.backup_urls.slice(0, 8) : [])];
      for (const url of urls) {
        const path = directVideoPath(url);
        if (!path || path.length > 512) continue;
        const candidate = { path, size: stream.size, width: stream.width, height: stream.height, duration: stream.duration };
        if (!paths.has(path)) paths.set(path, candidate);
        else if (JSON.stringify(paths.get(path)) !== JSON.stringify(candidate)) paths.set(path, null);
        if (paths.size > 128) return [];
      }
    }
  }
  // 相同路径的元数据冲突时不猜测该路径代表哪份文件。
  return [...paths.values()].filter(Boolean);
}

function originalSaveSource(note, stream) {
  const video = note?.video_info_v2?.media?.video;
  if (video?.drm_type !== 0 || !/^[a-f0-9]{24}$/i.test(note.id || "") ||
      !stream || ![stream.width, stream.height, stream.duration].every(n => Number.isFinite(n) && n > 0)) return null;
  const consumer = note.video_info_v2.consumer;
  const key = consumer?.origin_video_key || consumer?.originVideoKey;
  const link = note.share_info?.link;
  const validKey = typeof key === "string" && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]{16,}$/.test(key);
  const match = typeof link === "string" && link.match(/^https:\/\/www\.(?:xiaohongshu|rednote)\.com\/(?:discovery\/item|explore)\/([a-f0-9]{24})(?:\?[^#]*)?$/i);
  return { origin_key: validKey ? key : null, share_url: match?.[1] === note.id ? link : null,
    width: stream.width, height: stream.height, duration: stream.duration,
    playback_size: stream.size, captured_at: Date.now() };
}

function freshSaveEntry(entry) {
  const captured = entry?.original_save?.captured_at;
  return /^[a-f0-9]{24}$/i.test(entry?.id || "") && Number.isFinite(captured) &&
    captured > 0 && Date.now() >= captured && Date.now() - captured <= 3600000;
}

function saveCandidates(entry) {
  if (entry?.save_cache_version === 8) return Array.isArray(entry.save_candidates) ? entry.save_candidates : [];
  if (entry?.save_cache_version !== undefined) return [];
  // 更新脚本但尚未重开笔记时，旧缓存仍只允许原来的单路径匹配。
  const source = entry?.original_save;
  return source ? [{ path: directVideoPath(entry.url), size: source.playback_size,
    width: source.width, height: source.height, duration: source.duration }] : [];
}

function findSaveMatch(cache, path, size) {
  if (!path || !Array.isArray(cache) || cache.length > 100) return null;
  const matches = [];
  for (const entry of cache) {
    if (!freshSaveEntry(entry)) continue;
    const candidates = saveCandidates(entry);
    if (candidates.length > 128) continue;
    for (const candidate of candidates) {
      if (candidate?.path !== path) continue;
      // 先判定路径唯一，不能用大小消除跨笔记身份冲突。
      matches.push({ entry, candidate });
    }
  }
  if (matches.length !== 1) return null;
  const match = matches[0], c = match.candidate;
  if (![c.width, c.height, c.size].every(n => Number.isSafeInteger(n) && n > 0) ||
      !Number.isFinite(c.duration) || c.duration <= 0 || (size !== undefined && size !== c.size)) return null;
  return match;
}

function storeSaveEntries(entries) {
  let previous;
  try { previous = JSON.parse($.getdata("redBookVideoFeed") || "null"); } catch (_) { previous = null; }
  const byId = new Map();
  // 保留最近笔记，避免 APP 预取下一条响应后丢失当前笔记的保存身份。
  for (const entry of Array.isArray(previous) ? previous.slice(0, 20) : []) {
    if (entry?.save_cache_version === 8 && freshSaveEntry(entry)) byId.set(entry.id, entry);
  }
  for (const entry of entries) {
    byId.delete(entry.id);
    if (freshSaveEntry(entry)) byId.set(entry.id, entry);
  }
  const recent = [...byId.values()].reverse().sort((a, b) => b.original_save.captured_at - a.original_save.captured_at).slice(0, 20);
  $.setdata(JSON.stringify(recent), "redBookVideoFeed");
}

// 保存接口或匹配到的独立保存下载调用此函数；不改写信息流中的播放数据。
async function resolveOriginalSave(body, matchedCandidate) {
  const response = JSON.parse(body);
  const noteId = response.data?.note_id;
  const cache = JSON.parse($.getdata("redBookVideoFeed") || "null");
  const entries = Array.isArray(cache) ? cache.filter(item => item?.id === noteId) : [];
  const entry = entries.length === 1 ? entries[0] : null;
  const responseMatch = findSaveMatch(cache, directVideoPath(response.data?.download_url));
  const candidate = matchedCandidate || (responseMatch?.entry.id === noteId ? responseMatch.candidate : null);
  const source = entry?.original_save && { ...entry.original_save,
    ...(candidate ? { width: candidate.width, height: candidate.height, duration: candidate.duration } : {}) };
  if (!/^[a-f0-9]{24}$/i.test(noteId || "") || !source ||
      ![source.width, source.height, source.duration, source.captured_at].every(n => Number.isFinite(n) && n > 0) ||
      Date.now() < source.captured_at || Date.now() - source.captured_at > 3600000) return null;
  const deadline = Date.now() + 6500;
  let active = true;
  let timer;
  const fetchBeforeDeadline = async request => {
    if (!active || Date.now() >= deadline) throw new Error("mp4:probe-timeout");
    const response = await $task.fetch({ ...request, opts: { redirection: false, "auto-cookie": false } });
    if (!active || Date.now() >= deadline) throw new Error("mp4:probe-timeout");
    return response;
  };
  const resolve = async () => {
    let key = source.origin_key;
    if (!key) {
      // 只使用这条笔记的官方分享链接；不携带 App 的 Cookie 或认证头。
      const link = source.share_url;
      const officialPage = /^https:\/\/www\.(?:xiaohongshu|rednote)\.com\/(?:discovery\/item|explore)\/([a-f0-9]{24})(?:\?[^#]*)?$/i;
      const match = typeof link === "string" && link.match(officialPage);
      if (!match || match[1] !== noteId) return null;
      let page, pageUrl = link;
      for (let redirects = 0; redirects <= 2; redirects++) {
        page = await fetchBeforeDeadline({ url: pageUrl, headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        }});
        if (![301, 302, 303, 307, 308].includes(page.statusCode)) break;
        const location = Object.entries(page.headers || {}).find(([k]) => k.toLowerCase() === "location")?.[1];
        const target = typeof location === "string" && location.match(officialPage);
        if (!target || target[1] !== noteId) return null;
        pageUrl = location;
      }
      if (page.statusCode !== 200 || typeof page.body !== "string" || page.body.length > 2000000) return null;
      const stateText = page.body.match(/window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/);
      if (!stateText) return null;
      // JSON 解析，不执行网页脚本。出现无法识别的状态时回退。
      const state = JSON.parse(stateText[1].trim().replace(/;$/, "").replace(/([:,])undefined(?=[,}\]])/g, "$1null"));
      const detail = state.noteData?.data?.noteData || state.note?.noteDetailMap?.[noteId]?.note;
      if ((detail?.noteId || detail?.id) !== noteId) return null;
      key = detail.video?.consumer?.originVideoKey;
    }
    if (typeof key !== "string" || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]{16,}$/.test(key)) return null;
    const originalUrl = "https://sns-video-bd.xhscdn.com/" + key;
    const info = await probeOriginalMp4(originalUrl, fetchBeforeDeadline);
    if (!info || info.width * info.height < source.width * source.height ||
        Math.min(info.width, info.height) > 2160 || Math.max(info.width, info.height) > 4096 ||
        Math.abs(info.duration - source.duration) > 1500) return null;
    return { info, originalUrl };
  };
  try {
    const found = await Promise.race([
      resolve(),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error("mp4:probe-timeout")), 6500); })
    ]);
    active = false;
    if (typeof clearTimeout === "function") clearTimeout(timer);
    if (!found) {
      console.log("[原视频保存 v8.1] 未找到符合条件的原视频，使用原保存逻辑");
      return null;
    }
    const { info, originalUrl } = found;
    console.log(`[原视频保存 v8.1] 找到 ${info.width}×${info.height} ${info.codec}，${info.bitDepth}-bit ${info.dynamicRange}，${info.size} 字节`);
    return originalUrl;
  } catch (error) {
    active = false;
    if (typeof clearTimeout === "function") clearTimeout(timer);
    const reason = /^mp4:[a-z0-9-]+$/.test(error?.message || "") ? error.message.slice(4) : "network-or-page";
    console.log(`[原视频保存 v8.1] 原视频检查回退：${reason}；使用原保存逻辑`);
    return null;
  }
}

// 有界 MP4/MOV 元数据解析；只供保存探测使用，不转换媒体、不更改播放流。
// 未知非关键 box 按声明长度跳过；关键字段始终限制在所属 box 内。
async function probeOriginalMp4(url, fetchRange) {
  let total, requests = 0, received = 0;
  const read = async (start, end) => {
    if (++requests > 8) mp4Fail("probe-request-limit");
    const response = await fetchRange({ url, headers: {
      Range: `bytes=${start}-${end}`, "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0"
    }});
    const headers = Object.fromEntries(Object.entries(response.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(headers["content-range"] || "");
    if (response.statusCode !== 206 || !range || !range.slice(1).every(n => Number.isSafeInteger(+n)) ||
        +range[1] !== start || +range[2] > end || +range[2] < start || +range[3] <= +range[2]) mp4Fail("range-response");
    if (total !== undefined && total !== +range[3]) mp4Fail("file-size-changed");
    total = +range[3];
    const bytes = new Uint8Array(response.bodyBytes);
    received += bytes.length;
    if (bytes.length !== +range[2] - start + 1 || bytes.length > 1048576 || received > 1146880) mp4Fail("probe-byte-limit");
    return bytes;
  };
  let window = await read(0, 65535), windowStart = 0, offset = 0;
  for (let count = 0; count < 64 && offset < total; count++) {
    const required = Math.min(16, total - offset);
    if (offset < windowStart || offset + required > windowStart + window.length) {
      window = await read(offset, total - offset <= 1048576 ? total - 1 : offset + 4095);
      windowStart = offset;
    }
    const box = mp4BoxHeader(window, offset - windowStart, total - windowStart, true);
    if (offset === 0 && !["ftyp", "moov", "mdat", "free", "skip", "wide", "uuid"].includes(box.kind)) mp4Fail("container-signature");
    if (box.kind === "moof") mp4Fail("fragmented-mp4");
    if (box.kind === "moov") {
      if (box.size > 1048576) mp4Fail("metadata-size-limit");
      const bytes = box.end <= window.length ? window.slice(box.offset, box.end) : await read(offset, offset + box.size - 1);
      if (bytes.length !== box.size) mp4Fail("truncated-metadata");
      return parseOriginalMoov(bytes, total);
    }
    offset = windowStart + box.end;
  }
  mp4Fail("movie-metadata-not-found");
}

function mp4Fail(code) { throw new Error("mp4:" + code); }
function mp4Need(bytes, at, length, end = bytes.length) {
  if (!Number.isSafeInteger(at) || !Number.isSafeInteger(length) || at < 0 || length < 0 || at + length > end || end > bytes.length) mp4Fail("truncated-field");
}
function mp4U32(bytes, at, end = bytes.length) {
  mp4Need(bytes, at, 4, end);
  return bytes[at] * 16777216 + bytes[at + 1] * 65536 + bytes[at + 2] * 256 + bytes[at + 3];
}
function mp4U16(bytes, at, end = bytes.length) {
  mp4Need(bytes, at, 2, end); return bytes[at] * 256 + bytes[at + 1];
}
function mp4U64(bytes, at, end = bytes.length) {
  const value = mp4U32(bytes, at, end) * 4294967296 + mp4U32(bytes, at + 4, end);
  if (!Number.isSafeInteger(value)) mp4Fail("unsafe-64-bit-value");
  return value;
}
function mp4Text(bytes, at, length, end = bytes.length) {
  mp4Need(bytes, at, length, end);
  return String.fromCharCode(...bytes.slice(at, at + length));
}
function mp4BoxHeader(bytes, at, parentEnd, topLevel = false) {
  // parentEnd 可大于当前网络窗口；这里仅读取头，随后验证逻辑文件边界。
  mp4Need(bytes, at, 8);
  let size = mp4U32(bytes, at), header = 8;
  const kind = mp4Text(bytes, at + 4, 4);
  if (size === 1) { size = mp4U64(bytes, at + 8); header = 16; }
  else if (size === 0) {
    if (!topLevel) mp4Fail("nested-zero-size");
    size = parentEnd - at;
  }
  if (size < header || !Number.isSafeInteger(at + size) || at + size > parentEnd) mp4Fail("box-boundary");
  return { kind, offset: at, start: at + header, end: at + size, size };
}
function mp4Boxes(bytes, start, end, allowVisualPadding = false, topLevel = false) {
  mp4Need(bytes, start, end - start);
  const boxes = [];
  for (let at = start; at < end;) {
    // 部分 QuickTime 视觉样本的末尾有四字节全零填充，仅在此位置接受。
    if (allowVisualPadding && end - at === 4 && mp4U32(bytes, at) === 0) break;
    if (boxes.length >= 4096 || end - at < 8) mp4Fail("box-count-or-header");
    const box = mp4BoxHeader(bytes, at, end, topLevel);
    boxes.push(box); at = box.end;
  }
  return boxes;
}
function mp4One(boxes, kind, required = true) {
  const found = boxes.filter(b => b.kind === kind);
  if (found.length > 1 || (required && found.length !== 1)) mp4Fail("missing-or-duplicate-" + kind);
  return found[0];
}
function mp4Duration(bytes, mdhd) {
  mp4Need(bytes, mdhd.start, 4, mdhd.end);
  const version = bytes[mdhd.start];
  if (version !== 0 && version !== 1) mp4Fail("media-header-version");
  const scaleAt = mdhd.start + (version === 1 ? 20 : 12);
  const scale = mp4U32(bytes, scaleAt, mdhd.end);
  const ticks = version === 1 ? mp4U64(bytes, scaleAt + 4, mdhd.end) : mp4U32(bytes, scaleAt + 4, mdhd.end);
  const duration = ticks / scale * 1000;
  if (!(scale > 0 && duration > 0 && duration < 3600000)) mp4Fail("media-duration");
  return duration;
}
function mp4Rotation(bytes, tkhd) {
  mp4Need(bytes, tkhd.start, 4, tkhd.end);
  const version = bytes[tkhd.start];
  if (version !== 0 && version !== 1) mp4Fail("track-header-version");
  const at = tkhd.start + (version === 1 ? 52 : 40);
  const m = Array.from({ length: 9 }, (_, i) => mp4U32(bytes, at + i * 4, tkhd.end) | 0);
  if (m[2] !== 0 || m[5] !== 0 || m[8] !== 1073741824) mp4Fail("video-transform");
  const rotations = [[65536, 0, 0, 65536], [0, 65536, -65536, 0], [-65536, 0, 0, -65536], [0, -65536, 65536, 0]];
  const index = rotations.findIndex(r => r.every((v, i) => v === [m[0], m[1], m[3], m[4]][i]));
  if (index < 0) mp4Fail("video-transform");
  return index * 90; // 保留文件中的旋转和平移，不改写媒体；仅换算显示尺寸。
}
function mp4VideoSample(bytes, sample) {
  if (!["hvc1", "avc1"].includes(sample.kind)) mp4Fail("video-sample-type");
  mp4Need(bytes, sample.start, 78, sample.end);
  const config = mp4Boxes(bytes, sample.start + 78, sample.end, true);
  if (config.some(b => b.kind === "sinf")) mp4Fail("encrypted-video");
  const colors = config.filter(b => b.kind === "colr").map(b => {
    const type = mp4Text(bytes, b.start, 4, b.end);
    if (["nclc", "nclx"].includes(type)) mp4Need(bytes, b.start, type === "nclx" ? 11 : 10, b.end);
    return ["nclc", "nclx"].includes(type) ? { primaries: mp4U16(bytes, b.start + 4, b.end),
      transfer: mp4U16(bytes, b.start + 6, b.end), matrix: mp4U16(bytes, b.start + 8, b.end) } : null;
  }).filter(Boolean);
  if (colors.some(c => JSON.stringify(c) !== JSON.stringify(colors[0]))) mp4Fail("conflicting-color-metadata");
  const color = colors[0];
  const codec = sample.kind === "hvc1" ? "hevc" : "h264";
  const c = mp4One(config, codec === "hevc" ? "hvcC" : "avcC");
  mp4Need(bytes, c.start, codec === "hevc" ? 23 : 7, c.end);
  if (bytes[c.start] !== 1) mp4Fail("codec-config-version");
  let bitDepth = 8;
  if (codec === "hevc") {
    const profile = bytes[c.start + 1] & 31;
    const luma = 8 + (bytes[c.start + 17] & 7), chroma = 8 + (bytes[c.start + 18] & 7);
    if (![1, 2].includes(profile) || (bytes[c.start + 16] & 3) !== 1 || luma !== chroma ||
        ![8, 10].includes(luma) || (profile === 1 && luma !== 8)) mp4Fail("hevc-profile-or-depth");
    bitDepth = luma;
  }
  if (codec === "h264" && ![66, 77, 100].includes(bytes[c.start + 1])) mp4Fail("h264-profile");
  let dynamicRange = "SDR-or-unspecified";
  const hdrTransfer = color && [16, 18].includes(color.transfer);
  if (hdrTransfer) {
    if (codec !== "hevc" || bitDepth !== 10 || color.primaries !== 9 || color.matrix !== 9) mp4Fail("hdr-color-or-depth");
    dynamicRange = color.transfer === 16 ? "HDR10-PQ" : "HLG";
  }
  // 静态 HDR 元数据既可能在这些 box 中，也可能在 HEVC SEI 中；均保留原文件。
  for (const [kind, length] of [["mdcv", 24], ["clli", 4], ["amve", 8]]) {
    const item = mp4One(config, kind, false);
    if (item && item.end - item.start !== length) mp4Fail("hdr-metadata-size");
  }
  const dolby = config.filter(b => ["dvcC", "dvvC", "dvwC"].includes(b.kind));
  if (dolby.length) {
    if (dolby.length !== 1 || dolby[0].kind === "dvwC") mp4Fail("dolby-config");
    const d = dolby[0];
    mp4Need(bytes, d.start, 24, d.end);
    const packed = mp4U16(bytes, d.start + 2, d.end);
    const profile = (packed >>> 9) & 127, level = (packed >>> 3) & 63;
    const compatibility = bytes[d.start + 4] >>> 4, compression = (bytes[d.start + 4] >>> 2) & 3;
    // 仅放行单层、带 RPU 的 Profile 8.1/8.4；双层/P5 等保持回退。
    if (bytes[d.start] !== 1 || bytes[d.start + 1] !== 0 || profile !== 8 || level < 1 || level > 13 ||
        (packed & 7) !== 5 || compression !== 0 || ![1, 4].includes(compatibility) ||
        codec !== "hevc" || bitDepth !== 10 || !hdrTransfer ||
        color.transfer !== (compatibility === 1 ? 16 : 18)) mp4Fail("dolby-profile-or-base-layer");
    dynamicRange = compatibility === 1 ? "DolbyVision-8.1" : "DolbyVision-8.4";
  }
  const width = mp4U16(bytes, sample.start + 24, sample.end), height = mp4U16(bytes, sample.start + 26, sample.end);
  if (!width || !height) mp4Fail("video-dimensions");
  return { codec, width, height, bitDepth, dynamicRange };
}
function mp4AudioSample(bytes, sample) {
  if (sample.kind !== "mp4a") mp4Fail("audio-sample-type");
  mp4Need(bytes, sample.start, 28, sample.end);
  const version = mp4U16(bytes, sample.start + 8, sample.end);
  let extension = sample.start + 28, channels = mp4U16(bytes, sample.start + 16, sample.end);
  if (version === 1) extension += 16;
  else if (version === 2) {
    mp4Need(bytes, sample.start, 64, sample.end);
    extension = sample.offset + mp4U32(bytes, sample.start + 28, sample.end);
    channels = mp4U32(bytes, sample.start + 40, sample.end);
    if (extension < sample.start + 64) mp4Fail("audio-v2-size");
  } else if (version !== 0) mp4Fail("audio-description-version");
  if (![1, 2].includes(channels)) mp4Fail("audio-channels");
  const config = mp4Boxes(bytes, extension, sample.end);
  if (config.some(b => b.kind === "sinf")) mp4Fail("encrypted-audio");
  const descriptors = config.filter(b => b.kind === "esds");
  const wave = mp4One(config, "wave", false);
  if (wave) {
    const nested = mp4Boxes(bytes, wave.start, wave.end);
    if (nested.some(b => ["sinf", "wave"].includes(b.kind))) mp4Fail("audio-wave-structure");
    const format = mp4One(nested, "frma", false);
    if (format && (format.end - format.start !== 4 || mp4Text(bytes, format.start, 4, format.end) !== "mp4a")) mp4Fail("audio-wave-format");
    descriptors.push(...nested.filter(b => b.kind === "esds"));
  }
  const esds = mp4One(descriptors, "esds");
  if (mp4U32(bytes, esds.start, esds.end) !== 0 || !mp4AacDescriptor(bytes, esds.start + 4, esds.end)) mp4Fail("aac-descriptor");
  return { channels };
}
function parseOriginalMoov(bytes, size) {
  if (bytes.length > 1048576) mp4Fail("metadata-size-limit");
  const roots = mp4Boxes(bytes, 0, bytes.length, false, true), moov = mp4One(roots, "moov");
  if (roots.length !== 1) mp4Fail("movie-metadata-root");
  const children = box => mp4Boxes(bytes, box.start, box.end);
  const movie = children(moov);
  if (movie.some(b => ["mvex", "cmov"].includes(b.kind))) mp4Fail("fragmented-or-compressed-movie");
  const traks = movie.filter(b => b.kind === "trak");
  if (!traks.length || traks.length > 32) mp4Fail("track-count");
  const videos = [], audios = [];
  for (const trak of traks) {
    const track = children(trak), mdia = mp4One(track, "mdia"), media = children(mdia);
    const hdlr = mp4One(media, "hdlr"), handler = mp4Text(bytes, hdlr.start + 8, 4, hdlr.end);
    // 时间码、字幕及元数据轨不参与音视频兼容判断，不要求它们采用 AAC/H.264。
    if (!["vide", "soun"].includes(handler)) continue;
    const duration = mp4Duration(bytes, mp4One(media, "mdhd"));
    const stbl = mp4One(children(mp4One(media, "minf")), "stbl");
    const stsd = mp4One(children(stbl), "stsd");
    if (mp4U32(bytes, stsd.start, stsd.end) !== 0) mp4Fail("sample-description-version");
    const count = mp4U32(bytes, stsd.start + 4, stsd.end);
    const samples = mp4Boxes(bytes, stsd.start + 8, stsd.end);
    if (!count || count > 16 || samples.length !== count) mp4Fail("sample-description-count");
    const descriptions = samples.map(s => handler === "vide" ? mp4VideoSample(bytes, s) : mp4AudioSample(bytes, s));
    if (descriptions.some(d => JSON.stringify(d) !== JSON.stringify(descriptions[0]))) mp4Fail("changing-sample-format");
    if (handler === "vide") {
      const rotation = mp4Rotation(bytes, mp4One(track, "tkhd"));
      const { codec, width, height, bitDepth, dynamicRange } = descriptions[0];
      videos.push({ codec, width: rotation % 180 ? height : width, height: rotation % 180 ? width : height, bitDepth, dynamicRange, duration, rotation });
    } else audios.push({ ...descriptions[0], duration });
  }
  if (videos.length !== 1 || audios.length > 8) mp4Fail("audio-video-track-count");
  // 无音轨的视频正常；多个 AAC 音轨逐一检查。声音短于画面也不是封装错误。
  return { ...videos[0], duration: Math.round(videos[0].duration), size,
    audioDuration: audios.length ? Math.round(Math.max(...audios.map(a => a.duration))) : 0,
    audioChannels: audios[0]?.channels || 0, audioTracks: audios.length };
}
function mp4AacDescriptor(bytes, start, end) {
  const descriptor = (at, limit) => {
    mp4Need(bytes, at, 2, limit);
    const tag = bytes[at++];
    let size = 0, count = 0, value;
    do {
      mp4Need(bytes, at, 1, limit);
      if (++count > 4) mp4Fail("descriptor-length");
      value = bytes[at++]; size = size * 128 + (value & 127);
    } while (value & 128);
    mp4Need(bytes, at, size, limit);
    return { tag, start: at, end: at + size };
  };
  const es = descriptor(start, end);
  if (es.tag !== 3) return false;
  mp4Need(bytes, es.start, 3, es.end);
  const flags = bytes[es.start + 2];
  let at = es.start + 3;
  if (flags & 128) at += 2;
  if (flags & 64) { mp4Need(bytes, at, 1, es.end); at += 1 + bytes[at]; }
  if (flags & 32) at += 2;
  const decoder = descriptor(at, es.end);
  return decoder.tag === 4 && decoder.start + 13 <= decoder.end &&
    bytes[decoder.start] === 64 && (bytes[decoder.start + 1] >>> 2) === 5;
}

function directVideoPath(url) {
  const match = typeof url === "string" && url.match(/^https?:\/\/(?:sns-video-[a-z0-9-]+\.xhscdn\.com|sns-v[0-9]+\.(?:xhscdn|rednotecdn)\.com)(\/stream\/[0-9]+\/[0-9]+\/[0-9]+\/[A-Za-z0-9_-]+\.mp4)(?:\?[^#]*)?$/);
  return match ? match[1] : null;
}

async function rewriteDirectVideoSave() {
  const requestHeaders = Object.fromEntries(Object.entries($request.headers || {}).map(([k,v]) => [k.toLowerCase(), String(v)]));
  const responseHeaders = Object.fromEntries(Object.entries($response.headers || {}).map(([k,v]) => [k.toLowerCase(), String(v)]));
  // 基于用户 9.53 版抓包的窄匹配。播放器/预加载 UA、Range 和未知请求一律原样放行。
  if ($request.method !== "GET" || $response.statusCode !== 200 ||
      !/^discover\/9\.53 \(iPhone;/.test(requestHeaders["user-agent"] || "") ||
      "range" in requestHeaders || "if-range" in requestHeaders ||
      requestHeaders.referer !== "https://app.xhs.cn/" ||
      !/^(?:video\/mp4|application\/octet-stream)(?:;|$)/i.test(responseHeaders["content-type"] || "")) return {};
  const path = directVideoPath($request.url);
  if (!path) return {};
  const cache = JSON.parse($.getdata("redBookVideoFeed") || "null");
  const match = findSaveMatch(cache, path, Number(responseHeaders["content-length"]));
  if (!match) return {};
  console.log("[原视频保存 v8.1] 命中独立保存下载请求");
  const originalUrl = await resolveOriginalSave(JSON.stringify({ data: { note_id: match.entry.id } }), match.candidate);
  let target = originalUrl;
  if (!target) {
    // 原生保存可能选中相册不支持的流；仅保存请求可回到旧版已验证的兼容候选。
    const fallbackPath = directVideoPath(match.entry.url);
    const fallback = findSaveMatch(cache, fallbackPath);
    if (match.entry.save_cache_version === 8 && fallbackPath !== path &&
        fallback?.entry.id === match.entry.id) target = match.entry.url;
    if (!target) {
      console.log("[原视频保存 v8.1] 原视频未就绪，放行原下载");
      return {};
    }
  }
  // response-header 不替换响应体，保留原 Content-Length/Type 等实体字段。
  // 禁止缓存 307，避免把这次保存的跳转复用于后续播放器请求。
  const headers = {};
  const replaced = new Set(["location", "cache-control", "pragma", "expires", "etag", "last-modified"]);
  for (const [key, value] of Object.entries($response.headers || {})) {
    if (!replaced.has(key.toLowerCase())) headers[key] = value;
  }
  headers.Location = target;
  headers["Cache-Control"] = "no-store, private, max-age=0";
  headers.Pragma = "no-cache";
  console.log(originalUrl ? "[原视频保存 v8.1] 独立下载已返回 307 原视频跳转；播放请求未改动" :
    "[原视频保存 v8.1] 原文件不可用，独立下载已返回 307 兼容流兜底；播放请求未改动");
  return { status: "HTTP/1.1 307 Temporary Redirect", headers };
}

if (directVideoPath($request.url)) {
  rewriteDirectVideoSave().then(result => $done(result), () => {
    console.log("[原视频保存 v8.1] 下载探测失败，放行原下载");
    $done({});
  });
} else if ($response.body && /\/v10\/note\/video\/save(?:\?|$)/.test($request.url) &&
    typeof $task !== "undefined" && typeof $task.fetch === "function") {
  resolveOriginalSave($response.body).then(
    originalUrl => rewriteResponse($response.body, originalUrl),
    () => rewriteResponse($response.body)
  );
} else {
  rewriteResponse($response.body);
}
