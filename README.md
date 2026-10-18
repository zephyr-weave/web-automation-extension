# web-automation-extension

**网页自动化开发 Skill** —— 给任意网站做自动点击、自动导出、批量翻页抓取、定时页面操作，以及 Chrome/Edge MV3 扩展的**方法论 + 实战案例 + 测试工具链**。

A WorkBuddy skill for building browser automation extensions on arbitrary websites: methodology, worked case study, and a jsdom end-to-end test harness.

## 这个 skill 里有什么

```
web-automation-extension/
├── SKILL.md                          # 六步方法论主线（触发条件 + 工作流 + 质量基线）
├── references/
│   ├── site-recon.md                 # 摸现场清单：编码前必须采集的站点信息
│   ├── exception-playbook.md         # 异常分支手册：主流程之外的 90% 工程量
│   ├── platform-gotchas.md           # 平台坑速查：节流保活 / 合成点击 / 选择器漂移 / 测试环境限制
│   ├── case-lingdongsz.md            # 实战案例：生产级自动导出插件 v1.0→v1.5.0 全记录
│   └── testing-harness.md            # jsdom 测试 harness 使用指南
└── scripts/
    ├── new-test-template.js          # 端到端测试模板：复制即用，10 分钟搭出主循环测试
    └── make_silent_wav.py            # 后台保活静音 WAV 生成器（Chrome 有声豁免节流）
```

## 核心思路（先看这个）

**动手前先分清"坏在哪一层"**：

| 层 | 判据 | 解法 |
|---|---|---|
| A. 自己代码逻辑错 | 走查代码路径能找到明确错误点 | 直接修 + 加防御 |
| B. 对环境机制理解不足 | 代码单看没毛病，漏了平台约束 | 查文档 + 社区成熟方案 |
| C. 叠加 | 环境约束放大代码缺陷 | 两层分别处理 |

然后走六步：**摸现场 → 设计（主流程一句话 + 异常分支表）→ 小步实现带可观测性 → 仿真环境场景矩阵自测 → 交付四件套 → 迭代期反馈分层修复**。

每个异常分支都有明确动作，**不允许静默失败**；每个等待都有上限；每条日志都让陌生人能还原现场。

## 解决的典型问题

- 「做个自动导出/自动点击的插件」→ 六步法直接照做
- 「浏览器最小化后任务就不动了」→ Chrome intensive throttling，用静音音频保活（`make_silent_wav.py`）
- 「拾取/录制功能用过后，自动点击没反应了」→ 合成点击 `isTrusted` 被 capture 监听器吞掉
- 「拾取的按钮选择器又失效了」→ SPA 重渲染漂移，改稳定属性钩子 + 唯一性校验
- 「怎么给自动化写测试」→ `new-test-template.js` 复制即用

## 安装（WorkBuddy）

```bash
# 用户级（跟随所有项目）
git clone <本仓库> ~/.workbuddy/skills/web-automation-extension

# 或项目级（团队共享）
git clone <本仓库> <项目>/.workbuddy/skills/web-automation-extension
```

也可以从 Release 下载打包好的 zip。安装后，当对话中出现"自动化某个网站/做浏览器插件/网页自动操作"类需求时会自动触发。

## 测试模板快速上手

```bash
npm install jsdom
cp scripts/new-test-template.js test_main_loop.js
# 改三处：假站点结构 / 站点行为时序 / 底部断言
node test_main_loop.js
```

## 来源

方法论从生产级项目「蓝鲸选品自动导出助手」（Chrome MV3 扩展，v1.0 → v1.5.0，9 个 jsdom 端到端测试全绿）的全周期开发中提炼，每个结论都有对应的实战记录，详见 `references/case-lingdongsz.md`。

## License

MIT
