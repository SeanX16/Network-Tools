# 小红书仅保存原视频测试 v7（Quantumult X）

播放使用正式回退版的兼容流；保存时优先尝试下载分辨率不低于兼容流的标准编码原视频。v6 在通用 MP4/MOV 元数据解析基础上，增加 HEVC 10-bit、HDR10/PQ、HLG 和杜比视界 8.1/8.4 保存支持。订阅地址不变：

https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/Xiaohongshu-Original-Save-Test.conf

## 更新与使用

1. 退出小红书，更新本订阅的资源配置和引用脚本 `xhs-original-save-test.js`。从 v4/v5/v6 升级关键是更新 JS，日志前缀应为 `[仅保存原视频 v7]`；从早期版本升级也必须更新 CDN 规则和 MitM hostname。
2. 只启用本测试订阅，停用正式整合版、浏览与保存测试版、原版和独立高清保存版，保持 QX MitM 与证书信任正常。
3. 重新打开笔记，生成新缓存，确认播放正常后保存。
4. 检查相册里的分辨率、声音、时长和方向。脚本返回 307 不代表相册已经写入成功。

若 App 复用旧文件，可清理小红书自己的媒体缓存后退出重开；QX 清缓存任务只清理链接文本。异常时停用测试版，恢复[正式回退版](https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/Xiaohongshu-Merged.conf)。

## v7：同分辨率也优先原文件

原文件通过身份、编码、HDR、尺寸及时间检查后，只要总像素数不低于兼容流，就允许切换；不再要求严格更高。同为 1080P 的原文件也可使用，不以码率、文件大小或是否带拍摄信息作为额外门槛。低于兼容流的原文件仍回退。播放响应、请求匹配、原文件地址来源及原有安全边界不变。

此处“分辨率不低于”沿用宽×高的总像素数比较。原有短边至少 1080、长边最多 4096 等限制继续适用；不会因此放行原先不支持的低分辨率或编码。下载原文件不保证它具有设备、位置等元数据，也不保证码率更高。

已验证同分辨率由 v6 回退改为 v7 原文件 307、更高分辨率继续通过、较低分辨率继续回退，并核对播放响应不变。

## v6：10-bit 与 HDR 保存

新增接受 HEVC Main10、4:2:0、亮度与色度位深一致的 10-bit 原文件，包括 SDR、HDR10/PQ、HLG，以及单层带 RPU 的杜比视界 Profile 8.1/8.4。Main/Main10 的 8-bit 文件继续支持；H.264 的编码范围保持不变。

HDR 的 colr 元数据按 BT.2020 色域／矩阵及 PQ 或 HLG 传递函数检查；允许合法 mdcv、clli、amve 元数据。HDR10 静态信息也可能位于 HEVC SEI 内，不要求文件必须同时存在同名容器 box。杜比视界进一步检查版本、Profile 8、兼容 ID 1/4、基础层、RPU、无增强层及未压缩的动态元数据配置，并要求基础层颜色标记相符。

脚本仍只返回原文件地址，**不转码、不去除 HDR、不重封装、不修改颜色或动态元数据**。日志在尺寸后增加位深与类型，如 `10-bit HDR10-PQ`、`10-bit HLG`、`10-bit DolbyVision-8.4`。无明确 HDR 标记时显示 `SDR-or-unspecified`；元数据识别不等于对所有帧的 HDR 内容进行验证。

参考 [Apple HDR 文件元数据说明](https://developer.apple.com/av-foundation/High-Dynamic-Range-Metadata-for-Apple-Devices.pdf)、[Apple Dolby Vision 8.4 技术说明](https://developer.apple.com/documentation/technotes/tn3145-hdr-video-metadata)和 [FFmpeg Dolby 配置解析](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/dovi_isom.c)。

## v5 的兼容性改进

- 按 box 长度和父级边界解析，支持 32/64 位长度、顶层延伸到文件末尾的零长度 box；允许合法未知扩展、free、skip、wide、uuid 等出现在元数据前后，不再要求 mdat 后紧接 moov。
- 支持 mdhd、tkhd 的 v0/v1 时间字段，以及 QuickTime 音频描述 v0/v1/v2；AAC 描述可直接位于样本内或单层 wave 内。保留 v4 对视觉样本末尾四字节全零填充的处理。
- 接受静音视频；多个 AAC 音轨逐一检查。字幕、时间码及其他非音视频轨不再被误当成不支持的音视频。声音短于画面也不再单独导致拒绝。
- 支持标准 90/180/270 度旋转，按显示方向计算尺寸，下载的原文件和方向信息不变；不接受任意缩放、镜像、斜切或透视矩阵。
- 支持同一音视频轨内多个描述，要求每个描述都通过格式检查，且编码、尺寸或声道等选流相关字段一致。保存流程不再依赖无关的帧率估算和 stsz 样本计数。
- 格式、网络范围、资源预算和超时失败有具体原因码。未知非关键扩展可以跳过，但损坏的 box、越界字段、重复关键描述等不能靠忽略错误通过。

解析遵循 [Apple atom 边界和扩展规则](https://developer.apple.com/documentation/quicktime-file-format/atoms)、[QuickTime 音频扩展](https://developer.apple.com/documentation/quicktime-file-format/sound_sample_description_extensions)及 [v2 音频结构](https://developer.apple.com/documentation/quicktime-file-format/sound_sample_description_version_2)。时间字段布局另对照 [FFmpeg MOV 解析实现](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/mov.c)。

## 播放与保存的边界

播放响应、兼容选流、默认版本和缓存中的播放 URL 保持 v5 原样；信息流阶段没有原视频网络探测。仅向现有 `redBookVideoFeed` 缓存附加保存所需的分享信息，没有新增缓存键。图片、实况、净化和下载按钮功能沿用正式版。

保存请求覆盖 `sns-video-*.xhscdn.com` 和数字后缀的 `sns-vN.xhscdn.com`、`sns-vN.rednotecdn.com`。只有同时符合以下已观察到的请求特征才探测：

- GET，HTTP 200，Content-Type 为 video/mp4 或 application/octet-stream。
- iPhone `discover/9.53` User-Agent、Referer 为 `https://app.xhs.cn/`，没有 Range 或 If-Range。
- URL 中的媒体路径唯一匹配缓存，Content-Length 与缓存的兼容视频大小一致。
- 笔记身份匹配，保存信息在一小时内生成。

探测通过后，独立下载返回禁止缓存的 **307 Temporary Redirect**，原视频来自已验证的 `sns-video-bd.xhscdn.com`。原有 v10 保存接口同样保留原视频地址替换。播放器、预加载、Range、未知客户端和不匹配请求原样放行；超时或检查失败时继续原保存逻辑。

这些特征来自实际抓包，不是平台保证的永久保存标志。响应头重写不代理或替换媒体响应体，客户端可能在跟随跳转前已传输部分或全部兼容文件，不能保证只消耗原视频流量。

## 仍保留的限制

- 一个视频轨，H.264 avc1（Baseline/Main/High）或 8/10-bit 4:2:0 HEVC Main/Main10 hvc1；零至八个单声道／立体声 AAC 音轨。每个音视频轨最多 16 个描述。
- 原视频短边 1080–2160、长边不超过 4096，像素面积必须不低于兼容流，视频时长与笔记缓存相差不超过 1.5 秒；不放大低清视频。
- 保留 DRM、编码和尺寸检查。12-bit、4:2:2/4:4:4、H.264 High10、杜比视界 Profile 5/7 或双层／压缩动态元数据、ef51、hev1/avc3、其他编码、多视频轨、分片或压缩 movie 元数据等仍回退，不宣称支持所有合法媒体。
- 原视频探测总截止时间仍为 6.5 秒；媒体分段请求最多 8 次，moov 最大 1 MiB，分段响应累计最多 1,146,880 字节，顶层扫描最多 64 个 box。资源超限会回退，不会为兼容性无限下载。
- 运行时只检查容器元数据和分段响应一致性，不整段解码、不转码；不能保证媒体载荷完整，也不能预知 iPhone 相册是否接受该文件。后续下载或相册写入失败不能由脚本自动恢复。

## 日志

查找 `[仅保存原视频 v7]`：

- `命中独立保存下载请求`：请求符合筛选条件。
- `找到 宽×高 编码`：原视频通过元数据和选流条件检查。
- `独立下载已返回 307 原视频跳转；播放请求未改动`：已返回跳转。
- `原视频检查回退：原因码`：例如 `probe-timeout`（超时）、`range-response`（分段响应异常）、`box-boundary`（容器边界异常）、`video-sample-type`（视频样本类型未支持）、`hevc-profile-or-depth`（HEVC 配置不支持）、`network-or-page`（网络或网页解析失败）。日志不输出请求头、签名地址或网页正文。
- `未找到符合条件的原视频`：分享页／资源未找到，或尺寸、时长不符合切换条件。

## 验证范围

v6 新增五类样本：生成的 10-bit SDR、HDR10（含真实静态 SEI）、HLG，以及取自 [Dolby 官方公开测试内容](https://github.com/DolbyLaboratories/dolby-vision-contents)的 Profile 8.1/8.4 短片段。五类均由 ffprobe 确认 Main10、10-bit 像素格式及对应颜色／杜比视界配置，并通过完整视频解码；有音轨的文件同时完整解码音频。官方样本原为 hev1，测试片段通过提取实际参数集无转码封装为 hvc1，两个片段的 RPU NAL 内容与源片段逐条哈希一致。该处理只用于准备测试素材，生产脚本不进行此转换。

相同保存请求回放中，五类样本均表现为 v5 拒绝、v6 返回原文件 307，响应体和缓存没有被替换。12-bit、位深矛盾、错误 HDR 色域、加密、杜比视界错误 Profile／增强层／RPU 标志／颜色配置等均拒绝。之前的 13 类封装、真实 1080P/1440P/4K 样本、保存与播放边界及失败回退检查继续通过。

**以上验证不等于 iPhone 相册实测，也不等于验证了显示器上的 HDR 色彩效果。**尚未拿到小红书 HDR 笔记在用户手机上成功保存的反馈；本版发布的是已通过本地媒体和脚本验证的支持。


v5 新生成了 13 份有效文件并完整解码：基线、64 位 box、64 位 mdat、v1 时间头、v2 音频、多个描述、元数据前填充、末尾零长度 moov、静音、旋转、多音轨、字幕和时间码。13 份均通过解析及保存 307 回放，其中 12 种封装变体会被 v4 拒绝。它们是验证用素材，不是已在小红书 iPhone 上保存成功的 12 条笔记。

真实 1080P、1440P 和此前失败的 2160×3840 HEVC 样本继续通过。另用已确认的原文件 key 联网读取实际 4K CDN 头尾元数据，成功进入保存 307；该联网检查不覆盖分享页发现步骤。早期 1080P 分享链接本次未返回可用笔记信息，脚本按预期回退，不能将该次检查计为分享页端到端成功。已验证截断、越界、错误计数、不支持的版本／编码、加密音频、网络范围及文件大小变化、资源上限和超时会回退。既有保存请求、播放器／预加载、v10、迟到响应、缓存和图片回归检查通过；代码对比与真实信息流回放确认播放逻辑不变。

此前失败的真实 4K 文件为 2160×3840、HEVC Main hvc1 + AAC LC、约 16.3 秒、111,606,271 字节。完整分段下载和音视频解码已通过；v3 拒绝其 QuickTime 结构，v4/v5 可返回原视频跳转。用户已确认此前多条高清 HEVC 保存成功；本次新增封装范围及该 4K 样本的 iPhone 相册写入仍待实测。

状态码和响应头接口依据 [QX 官方示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-rewrite-response-header.js)。用户 HAR、认证信息和带签名资源地址未提交仓库。
