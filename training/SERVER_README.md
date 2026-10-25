# 觅归服务器训练准备包

用途：在用户已准备的Python虚拟环境中验证Qwen3.5-4B文本工具调用QLoRA训练。基础模型、PEFT、Transformers等属于第三方；自研Agent不由训练框架代替。本包未包含业务数据、密钥、运行器、模型权重或独立测试集，也未证明模型效果已经提升。

## 文件与边界

- train_lora.py：默认只显示计划；--check-data仅本地分词检查；--run才训练。
- verify_files.py、model-source.json：按固定官方提交核对权重大小及摘要。
- data/train.jsonl、validation.jsonl、manifest.json：合成轨迹及来源、分组与摘要。测试集保留本地，不上传用于训练或调参。
- KIT-SHA256SUMS.txt：包内文件摘要，核对传输与恢复。

数据由本项目有限模板组合，再通过实际自研执行器验证：560个训练任务、105个验证任务、175个本地测试任务。每次模型决策拆成监督样例，原始条数分别2480/465/775；去除可泄露场景类别的编号后，再按完整输入输出去重，当前保留1628/285/475条。任务拆出的样例条数不等于独立任务数。覆盖9个物品类别和7种交互任务；未覆盖全部真实语言、工具失败恢复及校园运营情况。部分后续表达共享模板，须人工复核；不能用这些数据自测成绩作为校园真实效果。

训练使用简化系统提示与实际工具定义/返回。完整生产系统提示不改写。仅监督最后一个assistant目标，不训练用户或工具返回；使用官方模板，将工具参数由运行时JSON字符串转换为模板要求的对象。过长样例跳过且统计，不截断工具参数；若丢失关键动作则停止。默认长度3072，OOM须根据报告分析后调小并重新核对动作覆盖。

## 已准备的服务器环境

用户已验证：Python3.10.12、PyTorch2.7.1+cu118、Transformers5.20.2、PEFT0.21.2、Accelerate1.15.0、bitsandbytes0.50.2、NumPy1.26.4；GPU实际矩阵及NF4前向运算通过，pip check通过。服务器4张RTX3090，每张24GB；开始前仍须检查当前空闲显存。

GPU与NF4小运算通过，不等于4B模型加载和反向传播通过。

## 准备后运行

假设工作目录为 ~/projects/migui-training，本包解压后位于migui-training-kit，模型另传入Qwen3.5-4B。

先显示计划，零模型加载：

```bash
cd ~/projects/migui-training
.venv/bin/python migui-training-kit/train_lora.py
```

模型校验（标准库、不加载模型、不联网）：

```bash
.venv/bin/python migui-training-kit/verify_files.py --model-dir Qwen3.5-4B
```

数据与官方分词器检查（不加载大模型、不训练、不读测试集）：

```bash
.venv/bin/python migui-training-kit/train_lora.py --check-data \
  --base-model Qwen3.5-4B --data migui-training-kit/data
```

检查通过并确认GPU0空闲后，首次限时10步：

```bash
CUDA_VISIBLE_DEVICES=0 .venv/bin/python migui-training-kit/train_lora.py --run \
  --base-model Qwen3.5-4B --data migui-training-kit/data \
  --output runs/smoke-001 --steps 10 --max-seconds 1200
```

输出目录必须尚不存在；重新尝试使用新目录，保留失败报告。模型完整性检查和分词准备在训练计时前进行；1200秒预算覆盖模型加载、验证损失、训练和保存，不含此前下载/传输。上限1800秒。首次只允许一张GPU可见，不启用多卡。

训练代码强制本地加载、关闭HF联网与遥测、不执行远程模型代码、不接实验跟踪平台。基础权重不覆盖；只保存适配器、分词器和报告。模型加载、反向传播、参数变化、保存均实际通过后，才会标记smoke-completed。

该标记只表示训练链路通过。验证损失来自固定小子集，不等于独立测试或Agent任务成功率。训练后仍需完整未见场景比较、合并/导出/量化及本机实际工具调用和断网复验；不自动替换部署模型。

## 来源

- 基础模型：https://huggingface.co/Qwen/Qwen3.5-4B ，固定提交见model-source.json。
- PEFT量化微调：https://huggingface.co/docs/peft/main/en/developer_guides/quantization
- Qwen3.5实现：https://huggingface.co/docs/transformers/main/en/model_doc/qwen3_5
- 工具调用训练数据：https://huggingface.co/docs/trl/main/en/sft_trainer#tool-calling-with-sft

本包脚本与合成任务由本项目编写，使用AI辅助开发；框架只用于训练和基础模型，不接管觅归Agent业务核心。
