# 百褶裙工作台

正式入口在 `D:/CodexWorkspace/papercut-editor`（织游角色、波兰剪纸所在画板）。旧“片语”实验品保留作参考。

1. 点击左上角四菱形，切换到 **Weave & Wander 资产**。原槽位显示十字绣小人；菜单的 **新建资产** 打开可扩展的制作类型列表。已有裙子原稿会直接恢复工作台，新建裙子保留其他文档。
2. 裙长 40–120 cm、腰围 50–110 cm、裙摆周长 100–360 cm；另可调褶数、褶深、锋利程度、布厚和布料。参考模板来自用户提供的照片，不代表某一族群服装的唯一标准。
3. **梯形平铺** 只显示一张固定成品轮廓，腰宽=腰围/2、下摆宽=裙摆周长/2、高度=裙长。选择“转裙面”后左右拖动，纹样像履带一样沿周向循环，连续展示正面、侧面、背面；右键拖动也可转裙面。“一键反面”在当前朝向上转半圈，“复位平铺”回正面并复位平移/缩放。中键平移、滚轮缩放，梯形没有平面旋转。观察角度不写入裙子数据、不占用撤销。默认仍可正反同步新笔迹，也可独立绘制；画笔与拼色片按照当前朝向落到原始 UV，跨后缝时自动拆分，SVG 导出一张中立平铺模板。
4. **圆弧展开** 使用同心圆和横纵一致的厘米比例。圆弧角度、半径由腰围、裙摆和裙长共同决定，不再固定为半圆。等腰围/裙摆的筒裙使用矩形极限。**圆环俯视** 是裙子的顶视投影，腰/摆半径对应周长，不是把所有版型强行摊成完整圆裙。图纸不含缝份、褶内裁布余量，不是生产裁剪纸样。
5. **回到画板细绘** 使用原生图层、手绘、剪纸、图章和布料工具。UV 上边是腰口，下边是裙摆，左右在后缝相接。右下三维窗随原稿更新。
6. **保存完整原稿** 输出 `.weave.json`，保留原生图层、Item 和裙子参数。浏览器保存与撤销复用文档机制。单独设计 JSON 只含参数和工作台笔迹；Godot 包中的 PNG 合成原生图层。

界面使用原生 `--ui-*` 主题、彩色图纸页签、42px 数字框；画布和预览无额外白底，辅助说明收进悬停提示。

三维默认穿在游戏 VolumeDoll 小人身上，可播放站立、行走、坐下、侧躺并暂停拖动。坐躺配套长椅直接导出 `components/rest_bench.gd` 的 85 个几何部件与基色（包括靠垫、坐垫和藤编篮），不是重画替代物。背后或低角度观察时椅子变半透明；游戏的纸面程序纹理不在 WebGL 预览中复刻。长椅按需读取约 5.9 MB 二进制数据。

垂坠的三个调节量是下垂重量、抗弯挺度、褶子开放。面料、布厚、裙长、裙摆及褶子参数决定默认值；手动修改后固定，可恢复面料默认。保存的可选 `drape` 字段会完整通过编辑器/Godot 往返。

动作预览固定腰口，逐段保持拟合后每条纵向材料线的参考长度，配合褶形松弛与坐躺包络，避免用硬拉长来追随膝盖。裙内腿部按裙长及躺姿遮挡阈值裁去。它仍是几何姿态预览，尚无完整布料自碰撞、面内不可伸长约束或真实缝合求解；极端尺寸与体型仍需实机校准。Godot 当前保存垂坠设置，但独立裙子组件尚未接入同一套动态求解和角色换装。

预览角色：`public/pleated-avatar/manifest.json` 和 `frames.bin`，57 帧、45 部件。长椅：`bench.json` 和 `bench.bin`。在游戏工程重建：

```powershell
& D:/Godot/Godot_v4.7.1-stable_win64/Godot_v4.7.1-stable_win64_console.exe --headless --path . --script tools/export_skirt_preview_avatar.gd -- --output D:/CodexWorkspace/papercut-editor/public/pleated-avatar
& D:/Godot/Godot_v4.7.1-stable_win64/Godot_v4.7.1-stable_win64_console.exe --headless --path . --script tools/export_preview_bench.gd -- --output D:/CodexWorkspace/papercut-editor/public/pleated-avatar
```

启动：`npm run dev -- --host 127.0.0.1 --port 3119 --strictPort`。

验证：`npm run lint`、`npm run build`、`npm test`；游戏工程的 `tools/verify_papercut_skirt.mjs` 检查原生画板往返，`tools/verify_skirt_preview.mjs` 检查播放和极端姿态，`tools/verify_skirt_revision.mjs` 检查正反同步、模式切换、长椅及纵向长度约束。截图在游戏工程 `captures/pleated_editor/` 和 `captures/skirt_revision/`。最终验收需要看实际画面，数值有限不等于没有穿插。
三维标题旁可切换 **材质预览 / 三渲二**，画板浮动预览也有同一切换。选择保存在本机浏览器预览偏好中，返回工作台或刷新后继续使用，不写入裙子 JSON 或导出纹样。三渲二移植游戏 `shaders/doll_volume.gdshader` 的光照方向、两级量化、0.94–1.0 淡明暗和 0.075 纸纹强度；纹理使用静止参考坐标与屏幕导数过滤，随动作贴附。此模式没有额外黑描边和镜面高光；长椅也采用同一预览纸感，未复刻 Godot 房间灯光、阴影及后处理。`node tools/verify-skirt-render-modes.mjs` 验证两模式像素差异、切回一致性、无白色截断、动作进度保留、浮动预览及偏好重载；Playwright 依赖可由 `PLAYWRIGHT_PACKAGE_JSON` 指向已有安装。

平铺交互回归：`node tools/verify-skirt-flat-belt.mjs` 检查一整圈像素回归、翻面、数据不变、背缝绘制和中键平移后的命中；截图使用四色验收纹样，不修改用户文档。

图纸尺寸在左上角 **设置 → 图纸尺寸** 切换 **隐藏 / 概括式 / 图例式**，默认图例式，偏好保存在本机。图例使用尺寸线、延长线、斜短线端点与数值，无文字底板。平铺标半腰围、半裙摆、垂直裙长；圆弧标腰口/裙摆弧长、展开斜长，另列裙长；圆环用引线标完整周长，裙长注明侧向尺寸。随参数即时更新，切换显示不修改设计、撤销或导出纹样。SVG 模板导出维持原有无标注形式。`node tools/verify-skirt-dimensions.mjs` 检查三种显示、偏好持久化、跨页同步、翻面保持与设计数据不变。
