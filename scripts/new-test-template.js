/* 网页自动化端到端测试模板（jsdom）
 * 用法：cp new-test-template.js test_<scenario>.js，然后改三处：
 *   1) html 常量        —— 假站点结构（复刻目标页面的按钮/弹窗/分页器）
 *   2) 模拟站点行为区   —— 按实测时序响应点击
 *   3) 底部断言区       —— 断言行为（计数/面板文本/日志特征串）
 * 运行：node test_<scenario>.js   （退出码 0 = PASS）
 * 依赖：jsdom（npm install jsdom；若装在非标准路径，改下面 require 的路径）
 * 详见 references/testing-harness.md
 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('缺少 jsdom：请先 npm install jsdom，或把本文件顶部的 require 改成实际路径');
  process.exit(2);
}

/* ---------- 1) 假站点结构：TODO 按目标页面改 ---------- */
const html = `<!DOCTYPE html><html><head><title>目标站点</title></head><body>
<div id="app">
  <div class="toolbar">
    <button class="tb-icon" id="target-btn" title="主操作按钮"><i class="icon-do"></i></button>
  </div>
  <div class="dialog-host"></div>
  <div class="pagination">
    <ul class="pager"><li class="is-active">1</li><li>2</li><li>3</li></ul>
    <button class="btn-next" id="next-btn">&gt;</button>
  </div>
</div>
</body></html>`;

const dom = new JSDOM(html, {
  url: 'https://example.com/#/list', // TODO 改成目标站点 URL
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;
const { document } = window;

/* jsdom 无布局：给所有元素打上非零矩形桩，模拟真实可见元素 */
window.Element.prototype.getBoundingClientRect = function () {
  return { width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20, x: 0, y: 0 };
};

/* content script 依赖的全局对象 */
global.window = window;
global.document = document;
global.localStorage = window.localStorage;
global.CSS = window.CSS || { escape: (s) => s };
global.getComputedStyle = window.getComputedStyle.bind(window);
global.MutationObserver = window.MutationObserver;
global.navigator = window.navigator;

/* chrome API mock：sendMessage 收信、onMessage 注册/反注册 */
const msgListeners = [];
global.chrome = {
  runtime: {
    sendMessage: (msg, cb) => { if (cb) cb({ ok: true }); },
    onMessage: {
      addListener: (fn) => msgListeners.push(fn),
      removeListener: (fn) => {
        const i = msgListeners.indexOf(fn);
        if (i >= 0) msgListeners.splice(i, 1);
      }
    }
  },
  tabs: { sendMessage: () => Promise.resolve() }
};
/* 模拟 background 转发的结果事件（如下载开始/完成） */
function fireResult(status) { msgListeners.forEach((fn) => fn({ type: 'RESULT', status })); }

/* 预置设置：缩短等待间隔加快测试；TODO 改成被测脚本实际读取的 key 与字段 */
window.localStorage.setItem('my_helper_settings_v1', JSON.stringify({
  interval: 500, minPageInterval: 500, detectMode: 'events', fixedWait: 5000,
  selectors: { mainBtn: '', confirmBtn: '', nextBtn: '' }
}));

/* ---------- 加载被测的 content script：TODO 改成实际路径 ---------- */
const code = fs.readFileSync(path.join(__dirname, '..', 'my-extension', 'content.js'), 'utf8');
eval(code);

/* ---------- 2) 模拟站点行为：TODO 按实测时序改 ---------- */
let mainClicks = 0;
let nextClicks = 0;
let currentPage = 1;
const LAST_PAGE = 3;

function renderPager(cur, last) {
  const pager = document.querySelector('.pager');
  pager.innerHTML = '';
  const li = document.createElement('li');
  li.textContent = String(cur);
  li.className = 'is-active';
  pager.appendChild(li);
}

document.getElementById('target-btn').addEventListener('click', () => {
  mainClicks++;
  setTimeout(() => {
    const host = document.querySelector('.dialog-host');
    if (host.querySelector('.dialog')) return;
    const dlg = document.createElement('div');
    dlg.className = 'dialog';
    dlg.innerHTML = '<button class="no">取消</button><button class="yes" id="confirm-yes">确认</button>';
    host.appendChild(dlg);
  }, 300);
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'confirm-yes') {
    setTimeout(() => fireResult('created'), 100);
    setTimeout(() => {
      fireResult('complete');
      const dlg = document.querySelector('.dialog');
      if (dlg) dlg.remove();
    }, 600);
  }
});

document.getElementById('next-btn').addEventListener('click', () => {
  nextClicks++;
  currentPage++;
  setTimeout(() => {
    renderPager(currentPage, LAST_PAGE);
    if (currentPage >= LAST_PAGE) {
      const nb = document.getElementById('next-btn');
      nb.classList.add('is-disabled');
      nb.disabled = true;
    }
  }, 400);
});

/* ---------- 3) 驱动与断言：TODO 改成实际控件 id 与期望 ---------- */
setTimeout(() => { document.getElementById('my-start').click(); }, 200);

/* 计时预算：先实测单轮耗时，超时 = 单轮 × 轮数 × 2 */
setTimeout(() => {
  const doneText = (document.getElementById('my-done') || {}).textContent || '';
  const stateText = (document.getElementById('my-state') || {}).textContent || '';
  const logLines = document.getElementById('my-log').textContent.trim().split('\n');
  console.log('--- 测试结果 ---');
  console.log('主操作点击次数:', mainClicks);
  console.log('下一页点击次数:', nextClicks);
  console.log('面板状态:', stateText, '|', doneText);
  console.log('日志尾部:', logLines.slice(-3).join(' / '));
  const pass =
    mainClicks === 3 &&
    nextClicks === 2 &&
    /完成 3/.test(doneText) &&
    /最后一页/.test(logLines.join('\n'));
  console.log(pass ? 'TEST PASS' : 'TEST FAIL');
  process.exit(pass ? 0 : 1);
}, 15000);
