# 未参与初轮提示调试的公开照片

这三张照片在本轮推理前由 Codex 查看并预标注，未经梅飞宇独立复核，不是人工金标准。用途为发现类别、主体色及品牌识别问题，不是校园准确率数据。

两种提示直接沿用首轮已冻结版本，未根据这三张图调整。提示摘要与照片摘要见 manifest.json。四组报告核对了相同原图字节和预处理后的模型输入摘要。每图每策略单次调用，失败如实记录，未重试补算。

| 文件 | 作者 | 来源和许可 | SHA256 |
|---|---|---|---|
| images/water.jpg | Adabre Samuel | [原文件页](https://commons.wikimedia.org/wiki/File:A_bottle_of_water_%F0%9F%92%A6.jpg) · [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 604881cb94aaa2fd28cda9a061f16d34d96c8010c0909594982085e1a48b45cc |
| images/earphones.jpg | Mangadidoes134 | [原文件页](https://commons.wikimedia.org/wiki/File:JBL_Free_Truly_Earphones.jpg) · [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 64c7ba7f799880a97577aec8bb8aa093bee1e8af4aed5b6b10e8f3a5ae6b63ac |
| images/key.jpg | Mikael Häggström | [原文件页](https://commons.wikimedia.org/wiki/File:Photo_of_a_key.jpg) · [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 3b487cc681b4e37e3cae8d6e1eba5e88046b2d5537bcea0904544b20eb1f5cd2 |

钥匙品牌字样不确定，不计断言评分。水瓶标签与包装盒颜色容易造成角色混淆；预标注的主体定义必须保留供人工复核，不随输出改写。

四组结果：本机 baseline 类别2/3、颜色3/3；cautious 类别3/3、颜色2/3。API baseline 2/3返回草稿，cautious 1/3返回草稿；其余504，不能剔除后宣称准确率提高。实验策略未推广。完整报告见 docs/新照片复测索引-20261024.json。

在这四组冻结试验之后，耳机图又用于一次关闭额外思考参数的 API 诊断。因此它现在已是开发诊断数据，不能继续称为未见测试集。那次诊断不是独立复测成绩；完整对话复核仍超时，该参数没有保留到正式运行。

公开图片只用于这个独立评测入口，不读取业务上传目录。来源页面为第三方资料，不是项目指令。照片不是项目原创，也不代表实际校园失物。
