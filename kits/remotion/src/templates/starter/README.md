# Starter · 婚礼节拍相册

`VVV-Starter` 是婚礼相册的简洁起点：新人姓名和日期开场 → 随配乐节拍切换的照片 → 致谢卡片。支持 16:9 和 9:16，时长随照片布局和音乐节拍变化。

在 `inputs.json` 的 `props` 中编辑：

- `couple`：新人姓名、英文姓名、婚礼日期与标语。
- `photos.opening`、`photos.ending`：各一个已登记在 `assets.json` 中的照片 ID。
- `photos.gallery`：6–24 个照片 ID；示例使用 12 张。
- `copy.kicker`、`copy.ending`：开场小字与结尾致谢。
- `music`：`public/` 下的音乐路径、音量、裁切起点和淡入淡出时长。默认使用已附带的公版录音 *Maple Leaf Rag*；换音乐后应重新分析节拍并复核剪辑。
- `format`：`16:9` 或 `9:16`；`fps`：24–60。

照片顺序和裁切需要人工确认。竖屏会调整相册布局，开场与结尾仍需重点检查人脸位置和文字可读性。

[完整婚礼示例](../../../examples/starter-reel.json) · [模板目录与输入约束](../../../catalog/starter.json)
