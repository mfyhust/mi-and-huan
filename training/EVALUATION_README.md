# 保存适配器重新加载与对照诊断

evaluate_adapter.py 默认只显示计划；只有 --run 才加载本机权重。复用已校验训练准备包的 train_lora.py、verify_files.py、model-source.json，按摘要读取 validation.jsonl。没有训练、网络模型、业务工具执行、独立测试集读取或自动部署。

一张GPU，基础模型仅加载一次：重新加载已保存适配器，逐个张量与 safetensors 文件精确对照；通过 PEFT disable_adapter 上下文取得同一量化基础模型的输出。两者均 eval、贪心生成、相同提示词、相同 NF4 配置，非量化参数精度处理与训练脚本一致。实现参考 https://huggingface.co/docs/peft/main/en/package_reference/peft_model 。依赖和基础模型不是项目原创，评测脚本由项目使用AI辅助开发。

默认14条验证决策覆盖七种场景与全部监督目标类型，当前只涉及7个独立任务，并非14个独立任务。每种模型每条最多生成192个token；达到上限保守标记为需复核。工具名和参数与金标准严格比较，等价原因措辞、可接受的不同操作顺序可能被判不匹配；普通文本不自动计成功，必须人工核对。保留原始输出用于复查。验证损失是样例平均值，非全验证集、非token加权指标，不与旧七条平均值直接比较。

这只是合成验证数据上的单步输出诊断，不是生产系统完整提示词下的自主多轮执行，也不是未见真实语言或校园成功率；qualityImproved 保持 null。之后仍需独立场景、真实自研工具执行、导出兼容与离线复验。

服务器上在 ~/projects/migui-training 执行（先确认GPU0空闲，输出目录必须未存在）：

```bash
CUDA_VISIBLE_DEVICES=0 .venv/bin/python -u migui-training-kit/evaluate_adapter.py --run \
  --base-model Qwen3.5-4B --adapter runs/smoke-001/adapter \
  --data migui-training-kit/data --output runs/compare-001 \
  --cases 14 --max-seconds 1200
```

完整性检查与数据分词准备不计入预算；加载、重新加载、对照推理、保存报告包含在20分钟预算。失败也写report.json，保留失败目录。报告在 runs/compare-001/report.json；不要把新脚本写进旧 KIT-SHA256SUMS，补充包有独立摘要。

本地已检查：语法、默认无模型加载、四组评分/覆盖回归、实际验证数据覆盖，以及微型随机CPU网络保存/重载/两种生成路径。尚未验证真实4B适配器重载或服务器生成；不能把微型测试写作真实模型通过。

## v2回合结束修正

用户首次服务器运行完成，重载张量检查通过。但原脚本未显式指定聊天结束token，实际模型默认EOS=248044，官方分词器/模板的im_end=248046；模型继续生成后续user/assistant回合，skip_special_tokens又隐藏了边界标记。旧的严格匹配结果不能作为模型真实工具能力或微调效果结论，原compare-001报告应保留。

v2显式设置聊天结束与原EOS的并集，保留原始特殊标记及结束原因，只去掉实际最后一个停止token；仍含跨回合标记的输出判为需复核，不能因首个工具正确就通过。严格理由文字和地点表达匹配暂不放宽，继续作为保守诊断并人工检查。更新后须用新输出目录runs/compare-002，不重训、不覆盖旧评测。

本地新增EOS不同和跨回合伪成功回归，共六项通过；官方分词器实际核对上述token编号，微型随机CPU网络验证生成在不同于原EOS的聊天结束token立即停止。真实4B的v2评测尚未运行。
