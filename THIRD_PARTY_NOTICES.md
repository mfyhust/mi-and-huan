# 第三方来源与许可

当前作品名为“觅&还”，内部xunhui及历史“觅归”“寻回”标识保留兼容。作者梅飞宇，使用Codex、DeepSeek等AI工具辅助分析、编程和文档整理；不声称全部代码由作者从零手写。

## 工程与通用依赖

- 初始工程来自Sites Vinext starter，包含构建、身份、存储绑定与开发辅助设施；部分模板文件直接保留，不是“仅参考”。见 `build/sites-vite-plugin.LICENSE`。
- React/React DOM、Vinext、Vite、Tailwind CSS、shadcn通用组件等保留原许可；TypeScript、Drizzle、Wrangler等亦属第三方。版本及传递依赖以 `package-lock.json` 和实际安装包许可为准。
- Lucide图标、React运行时许可副本见 `vendor/runtime-licenses/`；shadcn样式许可见 `vendor/shadcn-tailwind-4.13.0.LICENSE.md`。
- 图片解码、缩放与重编码使用Sharp/libvips，不声称自研编解码。Sharp为Apache-2.0，底层库保留各自许可。
- Node.js及其SQLite等运行时属于第三方。源码仓库不捆绑运行器或node_modules；保留的Node许可副本及来源仅用于对应历史交付的追溯。

## 基础模型与训练工具

- 本地运行采用Ollama与Qwen3.5-4B Q4_K_M分发，原许可见 `docs/模型许可/`；权重和运行器不进入GitHub。Ollama源码许可不等于其二进制分发中每一个GPU库使用同一许可。
- 官方Qwen Transformers训练检查点来源与固定提交见 `training/model-source.json`；不把模型改名成自研模型。
- PyTorch、Transformers、PEFT、Accelerate、bitsandbytes及NumPy等只用于可选研究。QLoRA为已有方法；当前网页不加载历史实验适配器，没有视觉微调成果声明。
- API模型由用户自己的服务权限提供；模型协议适配和业务Agent由本项目实现。不向第三方成品Agent转交业务核心。

## 地点与图片

- 校园地点整理事实性名称和来源，见 `data/campus-minhang*.mjs` 及 `docs/地点扩充来源与覆盖-20261023.json`。只整理名称、别名及公开来源；不复制地图瓦片、室内图，不承诺实时、完整或官方授权。用户补充地点须确认并另标来源。
- `lib/seed.mjs`等演示业务为合成记录，自写物品示意图不代表真实失物或服务台合作。
- `evals/real-photo-pilot/`和`evals/real-photo-holdout/`中的照片来自Wikimedia Commons，逐张作者、CC0-1.0许可与摘要见各目录README/manifest。照片不是本项目原创，不是校园业务图片；预标注未经独立人工核对。
- 文档工具与字体的历史许可副本保留在 `vendor/document-licenses/`；公开源码不捆绑完整字体或历史视频。

## 方案参考与自主实现

五个公开失物项目仅作需求与流程比较，具体仓库、提交、借鉴思路和核查局限见 `docs/开源参考审计.md`。没有将其业务源码、模型、页面、图片或数据作为本项目核心。自主新增模块及工程复用边界见 `docs/架构与原创范围.md`。

根目录MIT仅覆盖本项目自主新增应用代码；第三方模板、依赖、模型和图片保留原许可。保留署名和来源，不因作品改名、整理目录或公开快照而改变归属。
