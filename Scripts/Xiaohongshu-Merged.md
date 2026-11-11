# 小红书整合版（Quantumult X）

以 fmz200 的小红书重写及脚本为基础，合并 SeanX16 的兼容视频流高清保存修复。

## 安装

在 Quantumult X 的重写资源中添加：

https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/Xiaohongshu-Merged.conf

停用原来的 `Xiaohongshu.snippet` 和 `Xiaohongshu-HD-Save.conf`（以及其他命中相同接口的测试版），仅启用整合版，避免重复规则。更新资源和脚本，确认重写及 MitM 已启用、证书已经安装并信任，然后退出小红书并重新打开视频，让新的信息流响应生效。需要测试视频实际保存到相册；已打开页面可能仍使用旧数据。

## 保留的功能

原配置的全部启用规则均保留，包括广告域名拦截、弹窗及引导拦截、搜索净化、开屏处理、详情页小部件处理、图片画质增强、图片及实况保存、视频下载权限和按钮处理，以及原有实验性的评论区规则。原配置中注释掉的规则保持注释，不扩大启用范围。原有五条 `host, ..., reject` 行按原样保留，属于域名分流规则；若 QX 在重写资源中将它们忽略，需要放入分流规则才能实际拦截这些域名。

图片及非 v4 视频处理代码保持原样。原版本自身未生效或标注为实验的功能，不因合并而保证有效。

## 视频修复

- 在 v4 视频信息流中，只选用独立修复版已确认的 MP4 + AAC 类型：HEVC 的 533、616、618，H.264 的 258。
- 跨编码比较分辨率；相同分辨率优先 HEVC，同编码再比较平均码率。
- 信息流仅保留选中的兼容流并设为默认，避免保存时重新选到其他类型。
- 原有 v10 保存接口的缓存地址改用同一个选中流，保留完整 URL 和查询参数。
- 保留原版解除下载限制与下载按钮逻辑，不继承独立修复版“仅原生允许保存”的门槛；服务端限制仍可能影响实际下载。
- 仅对 `drm_type === 0` 且有兼容候选的媒体应用选流修复。没有候选时不裁剪视频流、不缓存替代地址，保存接口使用服务器返回地址；这不保证未知类型也能成功保存。
- 保留原版缓存机制：每次非空视频信息流覆盖缓存，不新增跨页面缓存。
- v4/v10 规则同时接受有查询参数和没有查询参数的 URL；补齐原规则使用但 hostname 缺少的 `so.xiaohongshu.com`。

## 手动查看和清除缓存

KB 按缓存原始文本的 UTF-8 编码字节数计算，1 KB = 1024 字节，保留两位小数。它表示缓存文本大小，不代表图片/视频文件大小，也不等于 QX 底层数据库的实际磁盘占用；字符数保留原有 JavaScript 字符串长度统计口径。

两个独立任务脚本：

- [查看缓存](https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/xhs-cache-view.js)：通知显示各项状态、字符数和 KB 大小，并显示合计；完整内容输出到本次执行日志；只读。
- [清除缓存](https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/xhs-cache-clear.js)：仅清除普通视频、图片/实况、评论实况、评论视频四项缓存，逐项读回确认结果；保留图片画质设置和其他脚本数据。

进入 QX「设置 → 配置文件 → 编辑」，在已有的 `[task_local]` 段下添加下面两行；没有该段时才新建 `[task_local]`：

```ini
0 0 * * * https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/xhs-cache-view.js, tag=小红书缓存查看, enabled=false
0 0 * * * https://raw.githubusercontent.com/SeanX16/Network-Tools/main/Scripts/xhs-cache-clear.js, tag=小红书缓存清除, enabled=false
```

两项均设置为 `enabled=false`，不自动定时执行。保存后进入「HTTP 请求／构造请求」列表，在对应任务上右滑，点击运行按钮手动执行；查看任务的执行日志可读到具体内容。若开启了 QX 通知权限，也会收到结果通知。不要为了手动运行而打开定时开关。

清除前先退出小红书，避免重写脚本同时写回缓存。清除后重新打开笔记或视频，会重新生成缓存；已保存到相册的内容不受影响。原版和整合版共用这些缓存名称，所以清除会同时影响两者。评论相关项暂无缓存是正常情况。

两份脚本本身没有网络请求；首次添加或更新脚本时，由 QX 从 GitHub 下载代码。查看脚本会把缓存中的笔记 ID 和带参数的视频链接写入本机执行日志，分享日志时可先隐去这些内容。

已用模拟 QX 环境验证只读查看、四项定向删除、重复清除、读写失败反馈与其他数据保留；尚未在 iPhone 实机执行。

## 来源与更新

- 原配置：https://github.com/fmz200/wool_scripts/blob/main/QuantumultX/rewrite/split/partX/Xiaohongshu.snippet
- 原配置 blob：`e632d51ef547c2a4e73acd773f96fefc3c49a6f5`
- 原脚本：https://github.com/fmz200/wool_scripts/blob/main/Scripts/xiaohongshu/xiaohongshu.js
- 原脚本 blob：`8b3e6927bc6ad6a8efb52e685284c683e09578d0`
- 高清保存修复：https://github.com/SeanX16/Network-Tools/blob/main/Scripts/xhs-hd-save.js
- 修复脚本 blob：`2d264b506e2aa6ef513c976df46ed5bb21e8d8a0`
- 原作者署名保留。本整合版复制当前上游代码；以后上游更新需要重新合并，不会自动跟随。

## 校验与实机范围

已通过 JavaScript 语法检查、20 个本地模拟场景及 24 个视频路由 URL 检查，并校验了原脚本除明确合并区域外保持一致、全部启用规则保留。覆盖兼容流选择、清晰度优先级、权限及按钮保留、多个视频 ID 对应的缓存地址、无候选回退，以及搜索、开屏、图片和实况等原版行为对比。

这些检查使用合成响应和模拟 QX 存储环境，不等于 iPhone/Quantumult X 实机验证。请使用原来失败的视频验证播放、保存到相册、清晰度和声音，并顺带检查图片与实况保存。
