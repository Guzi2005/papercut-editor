# 百褶裙工作台

本功能接入 `D:/CodexWorkspace/papercut-editor`（织游角色、波兰剪纸所在画板）。`weave-and-wander/asset-workbench` 是旧“片语”实验品，不是后续主入口。

1. 顶栏点 **百褶裙**。在普通作品中点击会新开裙子原稿，原作品保留在标签页。
2. **裙长** 40–120 cm、**裙摆大小** 100–360 cm（下摆外轮廓周长）独立调节，支持滑条和数值输入。另可调腰围、褶数、褶深、锋利程度、布厚和布料。摩梭、彝族、蜡染照片仅作为可编辑参考起点，来源随设计保存。
3. 梯形、半圆环、圆环共享同一份 UV 笔迹。半圆环是同心圆、横纵等比例，没有透视或椭圆压缩。三种设计视图不是含缝份的裁缝纸样。
4. **回到画板细绘** 使用原有图层、手绘、剪纸、图章和布料工具。方形 UV 上边是腰口，下边是裙摆；左右在后缝相接。底部裙子图仅作参考，真正笔迹保存在原生图层中。右下三维窗随原稿更新。
5. **保存完整原稿** 输出 `.weave.json`，保留原生图层、Item 和裙子参数。浏览器保存和撤销复用原有文档机制。单独设计 JSON 只含裙子参数及工作台笔迹，不含画板原生图层。
6. **导出 Godot 包** 输出 `skirt.json`、`skirt.png` 和三种 SVG 模板。JSON 与 PNG 放同一目录，游戏 `components/pleated_skirt.gd` 的 `load_design(path)` 载入。JSON 图案与原画板图层合成进 PNG，辅助褶线和参考图不导出。

界面使用画板 `--ui-*` 主题变量，跟随四套原生主题。图纸 tab 带彩色顶边，支持方向键、Home、End；数字框宽 42px，说明收进悬停提示，画布和预览没有额外白底。二维展开图保持归一化比例便于绘图，实际裙长和裙摆尺寸在三维中表达。

三维默认显示游戏小人穿着，可切换单裙，播放站立、行走、坐下、侧躺，暂停并拖动进度。角色和动作来自游戏 VolumeDoll 与现有骨架；试衣预览补齐被长裙省略的大腿，并把上衣收至腰线。这两项只在预览导出器中发生，不改游戏角色。

裙子通过游戏 LongSkirt 的变形笼适配动作，保留自己的褶子和纹样。它是姿态参考，尚无碰撞、重力布料或缝合求解。短窄裙坐下时仍有大腿穿插，超宽裙侧躺的自然垂坠需要继续校准。游戏运行时目前载入独立裙子，角色换装与商品链闭环是下一阶段。

预览资产：`public/pleated-avatar/manifest.json` 和 `frames.bin`，57 帧、45 个部件，按需加载约 16 MB。当前只有一套体型和发型；坐躺循环包含进入、停留、起身。重建命令在游戏工程运行：

```powershell
& D:/Godot/Godot_v4.7.1-stable_win64/Godot_v4.7.1-stable_win64_console.exe --headless --path . --script tools/export_skirt_preview_avatar.gd -- --output D:/CodexWorkspace/papercut-editor/public/pleated-avatar
```

启动：`npm run dev -- --host 127.0.0.1 --port 3119 --strictPort`。原有项目桥接启动器继续有效。

验证：`npm run lint`、`npm run build`、`npm test`（114 项通过）。游戏工程中 `tools/verify_papercut_skirt.mjs` 验证原生画板往返，`tools/verify_skirt_preview.mjs` 验证播放、键盘页签及八组极端姿态。截图在 `captures/pleated_editor/`。数值有限、页面无异常不等于服装没有穿插，仍需查看截图。
