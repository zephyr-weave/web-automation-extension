# 平台坑速查：网页自动化的六个经典陷阱

> 遇到"卡住/不动了/点击没反应/最小化就停"先查这张表。每条都来自生产环境实战。

## 1. Chrome 严格计时器节流（最小化/切页面后任务停滞）

**现象**：任务在前台跑得好好的，一切换标签页或最小化浏览器，几分钟后就"卡住"不动了。

**根因**：Chrome 对后台标签页的计时器做两级节流——普通节流（setTimeout ≥1s）+ **intensive throttling**：页面隐藏约 5 分钟后，定时器被限制为**每分钟最多 1 次**。所有 sleep/轮询随之停滞。

**解法（社区验证模式）**：让标签页保持"**有声**"状态可豁免 intensive throttling。运行期间循环播放一路**全静音音频**（用 `scripts/make_silent_wav.py` 生成 data URI，0.1s 8kHz 8bit 单声道零样本）：

```js
const audio = new Audio(SILENT_WAV); // data:audio/wav;base64,...
audio.loop = true;
audio.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
document.body.appendChild(audio);
audio.play(); // 必须在用户手势的同步上下文里调用（如"开始"按钮的 click handler 内），满足自动播放策略
```

**注意事项**：
- `play()` 返回 Promise，`.catch()` 里记日志即可，播放失败不阻塞主流程
- 暂停/停止/任务完成时 `pause()` 并移除元素，释放有声状态
- 副作用：运行期间浏览器会在该标签页显示扬声器图标（实际静音）——**必须写进用户文档**，否则用户会慌
- jsdom 中 `HTMLMediaElement.play/pause` 未实现（返回 undefined 不抛错），测试里打桩计数即可

## 2. 合成点击被 capture 监听器吞掉（"拾取/录制后任务失效"）

**现象**：用过元素拾取（或事件录制）功能后，自动循环里的点击不再生效，站点毫无反应。

**根因**：`el.click()` 产生**合成事件**，`isTrusted === false`；而真实用户点击 `isTrusted === true`。拾取监听器常以 document **capture** 阶段注册，命中后 `stopImmediatePropagation()` 阻止后续监听器——**包括站点自己的 handler**。拾取模式忘了退出时，循环里的每次 `el.click()` 都被吞掉。

**解法（三层，各自独立成立）**：
1. **直接修**：拾取监听器开头加守卫 `if (e.isTrusted === false) return;`——合成点击不参与拾取语义，直接放行
2. **兜底**：任务开始时自动退出拾取模式（`cancelPicking()`），用户忘了退出也不炸
3. **提示+回退**：见第 3 条

## 3. SPA 选择器漂移（"上次拾取的按钮又找不到了"）

**现象**：手动拾取的按钮选择器，页面重渲染/路由切换后失效。

**根因**：`tag:nth-of-type(n)` 路径和纯样式 class 在 SPA 重渲染后错位。

**解法**：生成选择器时优先用**稳定属性钩子**，并做唯一性校验：

```js
const HOOK_ATTRS = ['data-testid', 'data-test-id', 'data-id', 'title', 'aria-label', 'name', 'type', 'placeholder'];
for (const attr of HOOK_ATTRS) {
  const v = el.getAttribute(attr) || '';
  if (v && v.length <= 64 && !/["'\\]/.test(v)) {
    const sel = `${el.tagName.toLowerCase()}[${attr}="${v}"]`;
    if (document.querySelectorAll(sel).length === 1) return sel; // 唯一才采用
  }
}
// 都不命中再退回 id / 路径方式
```

**配套**：已保存选择器未命中时，**一次性提示**（每轮运行每种元素只提示一次，防刷屏）+ 自动回退到自动识别，永不静默失败。

## 4. jsdom 测试环境的硬限制

- **无法伪造 `isTrusted === true`**：MouseEvent 的 isTrusted 是实例级不可配置访问器，impl 对象也拿不到。**不要为测试改产品语义**——改用"合成点击不被吞掉"反向证明守卫有效（jsdom 原生派发的事件就是 isTrusted=false，正好是合成点击语义）
- `HTMLMediaElement.play/pause` 未实现：打桩计数
- 无布局：给 `Element.prototype.getBoundingClientRect` 打非零矩形桩，模拟可见元素
- 媒体不加载：`new Audio(src)` 可用，src/loop/style 均可断言

## 5. 下载/结果完成检测

- 首选 `chrome.downloads` API（background service worker 监听 onCreated/onChanged，转发给 content script），实现"下载完成再翻页"的精确节奏
- 兜底：固定等待（用户可切换），应对国产浏览器对 downloads API 的限制
- 分级：20 秒无下载开始→提示；35 秒无任何下载→自动暂停

## 6. MV3 content script 的隔离世界

- content script 跑在 isolated world，但**共享页面 DOM**；`document`、`CSS`、`MutationObserver`、`Audio` 等页面构造器可直接使用
- 注入的媒体元素是真实页面元素，计入标签页有声状态（保活方案因此有效）
- 站点重绘可能误删注入的面板：用 MutationObserver 监听并在缺失时重建（用户主动关闭过则不重建）
- 弹窗通信：`chrome.runtime.sendMessage/onMessage`，注意 background 是 service worker，可能被休眠——关键状态放页面侧
