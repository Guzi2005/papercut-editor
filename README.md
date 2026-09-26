# 剪纸编辑器

面向 Weave and Wander 与 Godot 4 的矢量剪纸资产编辑器。

支持剪纸、笔刀、几何形、手绘、色块选取、深度层与物件分组、纹样与纸张质感、项目存档，以及 SVG、PNG 和 Godot 场景导出。

## 本地运行

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

打开终端显示的本地地址，默认端口为 3000。

```sh
npm test
npm run lint
npm run build
```

## Godot 资产

通过「文件 → 导出到 Godot」生成 ZIP，解压到 Godot 工程根目录。
导出包包含独立物件场景、部件贴图、挂点、总览场景、资产清单与可编辑源文件。

详见 [Godot 导出说明](docs/godot-export.md)。

## 版本历史

本仓库从原 `Guzi2005/MosaicArchive` 仓库的 `cursor/weave-editor-pipeline-0c4e` 分支独立，保留原有 Git 提交历史。`main` 为后续版本管理的主分支。
