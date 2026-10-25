# 公开真实照片识图小样本

这些照片仅用于测试，未放进业务数据库，也不是本项目原创图片。三张均来自已核对CC0声明的Wikimedia Commons文件页；作者、来源、许可、原图SHA256见manifest.json。原图保留，推理时旋转、缩至长边1000像素并转JPEG质量82，清除EXIF；两版均走相同处理，模型输入摘要逐张核对。

| 本地文件 | 作者 | 来源 |
|---|---|---|
| images/bottle.jpg | Jessephu | [Close view of a water bottle](https://commons.wikimedia.org/wiki/File:Close_view_of_a_water_bottle.jpg) |
| images/umbrella.jpg | Swethasakthivel | [Folded Umbrella](https://commons.wikimedia.org/wiki/File:Folded_Umbrella.jpg) |
| images/keys.jpg | Eviatar Bach | [Keys with pink background](https://commons.wikimedia.org/wiki/File:Keys_with_pink_background.JPG) |

图片许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。代码与文档的来源说明保持原项目约定，不将图片许可扩展到整个项目。

标注为Codex在调用模型前看图预标注，未经梅飞宇独立复核，不能称人工双盲金标准。钥匙串没有唯一主体颜色、品牌不明，相关字段只列入人工复核，不计正确/错误。局部瓶图的类别以文件来源和图片预标注为水杯；留空待确认单列abstained，不计“识别正确”。错填其他单列wrong，两者不能合并成正确率。部件描述和材质幻觉需逐图人工复核，当前脚本不声称自动完成语义事实判定。

此数据已经用于调整提示，属于开发集；今后的泛化效果须使用新的、未参与调试的授权照片验证。三张单次试验不适合估算校园识图准确率或判断模型普遍速度。

从项目根目录运行：

```bash
node evals/photo-pilot.mjs
node evals/photo-pilot.mjs --run --edition local
node evals/photo-pilot.mjs --run --edition api --allow-public-api
node evals/photo-pilot.mjs --run --edition local --policy cautious
node evals/photo-pilot.mjs --run --edition api --policy cautious --allow-public-api
```

默认只检查来源、摘要和标注，不调用模型。最后一条仅向已配置交大视觉模型发送这三张公开CC0照片，需要既有api/config.local.json，密钥不写进报告；不接受任意照片目录或用户业务照片。每例一次请求，不自动重试；超时、错误、留空都保留。输出位于Git忽略的.offline-evaluations，原始报告经核查后另存研发证据。临时数据库只保存这些公开测试图，运行结束关闭，不创建物品或任务。

正式服务默认baseline。cautious仅为显式选择的实验策略，浏览器请求不能切换；当前API实验复测3例均超时，未推广到正式服务。prompt-baseline.txt与prompt-cautious.txt保存本轮实际比较的提示文本。
