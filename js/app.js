import { Modal, Toast } from './ui.js';

const ADMIN_TOKEN_KEY = 'pictures-lib-admin-token';
const DELETED_R2_KEY = 'pictures-lib-deleted-r2-paths';

const state = {
  items: [],
  filtered: [],
  source: 'all',
  folder: 'all',
  query: '',
  sort: 'newest',
  r2NonImagesTotal: 0,
  adminToken: localStorage.getItem(ADMIN_TOKEN_KEY) || '',
  deletedR2Paths: readDeletedR2Paths(),
  selectedR2Paths: new Set(),
};

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

const $ = (id) => document.getElementById(id);

function readDeletedR2Paths() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_R2_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDeletedR2Paths() {
  localStorage.setItem(DELETED_R2_KEY, JSON.stringify([...state.deletedR2Paths]));
}

const formatBytes = (bytes) => {
  if (!bytes) return '未知大小';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const itemTime = (item) => Date.parse(item.uploadedAt || item.lastModified || '') || 0;

const formatDate = (value) => {
  if (!value) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
};

const formatDateTime = (value) => {
  if (!value) return '上传时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const shortType = (value) => String(value || 'image/*').replace('image/', '').toUpperCase();

function renderStats() {
  const githubTotal = state.items.filter((item) => item.source === 'github').length;
  const r2Total = state.items.filter((item) => item.source === 'r2').length;
  const stats = [
    ['总图片', state.items.length],
    ['GitHub', githubTotal],
    ['R2 图片', r2Total],
    ['R2 非图片', state.r2NonImagesTotal],
  ];
  $('stats').replaceChildren(...stats.map(([label, value]) => {
    const node = document.createElement('div');
    node.className = 'stat';
    node.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    return node;
  }));
}

function setupFilters(items) {
  const sources = [...new Set(items.map((item) => item.source))].sort(collator.compare);
  $('source').append(...sources.map((source) => {
    const node = document.createElement('option');
    node.value = source;
    node.textContent = source === 'r2' ? 'Cloudflare R2' : 'GitHub';
    return node;
  }));
  updateFolderOptions();
}

function updateFolderOptions() {
  const sourceItems = state.source === 'all' ? state.items : state.items.filter((item) => item.source === state.source);
  const folders = [...new Set(sourceItems.map((item) => item.folder))].sort(collator.compare);
  
  const folderSelect = $('folder');
  folderSelect.innerHTML = '<option value="all">全部目录</option>';
  folders.forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder;
    opt.textContent = folder;
    folderSelect.appendChild(opt);
  });
  
  if (!folders.includes(state.folder)) state.folder = 'all';
  folderSelect.value = state.folder;
}

function matches(item) {
  const query = state.query.trim().toLowerCase();
  if (state.source !== 'all' && item.source !== state.source) return false;
  if (state.folder !== 'all' && item.folder !== state.folder) return false;
  if (!query) return true;
  return [item.path, item.name, item.folder, item.url].some((value) => String(value || '').toLowerCase().includes(query));
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (state.sort === 'name') return collator.compare(a.path, b.path);
    if (state.sort === 'size') return (b.size || 0) - (a.size || 0) || collator.compare(a.path, b.path);

    const diff = itemTime(b) - itemTime(a);
    if (diff) return diff;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return collator.compare(a.path, b.path);
  });
}

function selectedItems() {
  return state.items.filter((item) => item.source === 'r2' && state.selectedR2Paths.has(item.path));
}

function visibleR2Items() {
  return state.filtered.filter((item) => item.source === 'r2');
}

function pruneSelection() {
  const availablePaths = new Set(state.items.filter((item) => item.source === 'r2').map((item) => item.path));
  for (const path of state.selectedR2Paths) {
    if (!availablePaths.has(path)) state.selectedR2Paths.delete(path);
  }
}

function updateSelectionBar() {
  const selectedCount = selectedItems().length;
  const visibleCount = visibleR2Items().length;
  const bar = $('selectionBar');
  bar.hidden = selectedCount === 0 && visibleCount === 0;
  $('selectionSummary').textContent = selectedCount
    ? `已选择 ${selectedCount} 张 R2 图片`
    : `当前筛选有 ${visibleCount} 张 R2 图片可选`;
  $('selectVisibleR2').disabled = visibleCount === 0;
  $('clearSelection').disabled = selectedCount === 0;
  $('bulkDelete').disabled = selectedCount === 0;
  $('bulkDelete').textContent = '删除已选';
}

function render() {
  state.filtered = sortItems(state.items.filter(matches));
  pruneSelection();
  const knownTimes = state.items.filter((item) => itemTime(item)).length;
  
  $('meta').replaceChildren(
    metaPill(`显示 ${state.filtered.length} / ${state.items.length}`),
    metaPill(`时间信息 ${knownTimes}`),
    metaPill(`快照 ${new Date(window.galleryGeneratedAt).toLocaleString()}`),
  );
  
  $('empty').style.display = state.filtered.length ? 'none' : 'block';
  $('grid').replaceChildren(...state.filtered.map(renderCard));
  updateSelectionBar();
}

function metaPill(text) {
  const node = document.createElement('span');
  node.className = 'meta-pill';
  node.textContent = text;
  return node;
}

function renderCard(item, index) {
  const card = document.createElement('article');
  const selected = item.source === 'r2' && state.selectedR2Paths.has(item.path);
  card.className = selected ? 'card selected' : 'card';
  card.style.animationDelay = `${Math.min(index, 24) * 20}ms`;
  const uploadedAt = item.uploadedAt || item.lastModified;
  
  card.innerHTML = `
    <div class="thumb-container">
      ${item.source === 'r2' ? `
        <label class="select-control">
          <input class="select-action" type="checkbox" ${selected ? 'checked' : ''} aria-label="选择 ${escapeHtml(item.path)}" />
          <span>选择</span>
        </label>
      ` : ''}
      <img class="thumb" src="${item.url}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer" />
    </div>
    <div class="body">
      <div class="card-head">
        <span class="source ${item.source}">${item.source === 'r2' ? 'R2' : 'GitHub'}</span>
        <span class="time-badge">${escapeHtml(formatDate(uploadedAt))}</span>
      </div>
      <div class="name" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</div>
      <dl class="info-grid">
        <div><dt>大小</dt><dd>${escapeHtml(formatBytes(item.size))}</dd></div>
        <div><dt>类型</dt><dd>${escapeHtml(shortType(item.contentType))}</dd></div>
      </dl>
      <div class="actions">
        <a href="${item.url}" target="_blank" rel="noreferrer">查看</a>
        <button class="copy-action" type="button">复制链接</button>
        ${item.source === 'r2' ? '<button class="danger delete-action" type="button">彻底删除</button>' : ''}
      </div>
    </div>
  `;

  const copyButton = card.querySelector('.copy-action');
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      Toast.show('链接已复制到剪贴板');
      const originalText = copyButton.textContent;
      copyButton.textContent = '已复制';
      setTimeout(() => { copyButton.textContent = originalText; }, 2000);
    } catch (err) {
      Toast.show('复制失败');
    }
  });

  const deleteButton = card.querySelector('.delete-action');
  if (deleteButton) {
    deleteButton.addEventListener('click', () => handleDelete(item, deleteButton));
  }
  const selectInput = card.querySelector('.select-action');
  if (selectInput) {
    selectInput.addEventListener('change', (event) => {
      if (event.target.checked) state.selectedR2Paths.add(item.path);
      else state.selectedR2Paths.delete(item.path);
      card.classList.toggle('selected', event.target.checked);
      updateSelectionBar();
    });
  }
  return card;
}

function handleDelete(item, button) {
  Modal.confirm('确认删除', `确认从 R2 永久删除这个文件吗？此操作不可恢复。\n\n路径: ${item.path}`, () => {
    Modal.prompt('再次确认', `为防止误删，请输入文件的完整路径进行确认：\n\n${item.path}`, item.path, (input) => {
      if (input !== item.path) {
        Toast.show('路径输入不匹配，操作已取消');
        return;
      }
      executeDelete(item, button);
    });
  });
}

async function deleteR2Path(path, token) {
  const response = await fetch('/api/assets/delete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ source: 'r2', path }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    if (response.status === 401) clearAdminToken();
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function executeDelete(item, button) {
  const token = await requestAdminToken();
  if (!token) return;

  button.disabled = true;
  button.textContent = '删除中...';

  try {
    await deleteR2Path(item.path, token);

    state.deletedR2Paths.add(item.path);
    state.selectedR2Paths.delete(item.path);
    saveDeletedR2Paths();
    state.items = state.items.filter((candidate) => !(candidate.source === 'r2' && candidate.path === item.path));
    
    Toast.show('文件已成功删除');
    updateFolderOptions();
    renderStats();
    render();
  } catch (error) {
    button.disabled = false;
    button.textContent = '彻底删除';
    if (error.status === 401) {
      Toast.show('删除口令错误，已清除保存的记录');
      return;
    }
    Toast.show(`删除失败: ${error.message}`);
  }
}

function confirmAsync(title, message, confirmLabel = '确定') {
  return new Promise((resolve) => {
    Modal.show({
      title,
      content: message,
      actions: [
        { label: '取消', onClick: () => resolve(false) },
        { label: confirmLabel, type: 'danger', onClick: () => resolve(true) },
      ],
    });
  });
}

function promptAsync(title, message, placeholder) {
  return new Promise((resolve) => {
    Modal.prompt(title, message, placeholder, (input) => resolve(input));
  });
}

async function handleBulkDelete() {
  const items = selectedItems();
  if (!items.length) {
    Toast.show('先选择要删除的 R2 图片');
    return;
  }

  const preview = items.slice(0, 8).map((item) => item.path).join('\n');
  const more = items.length > 8 ? `\n... 另有 ${items.length - 8} 个文件` : '';
  const confirmed = await confirmAsync(
    '批量删除 R2',
    `将永久删除 ${items.length} 个 R2 源文件，此操作不可恢复。\n\n${preview}${more}`,
    '继续删除',
  );
  if (!confirmed) return;

  const typedCount = await promptAsync(
    '确认批量删除',
    `为防止误删，请输入数字 ${items.length} 确认删除 ${items.length} 个 R2 文件。`,
    String(items.length),
  );
  if (typedCount.trim() !== String(items.length)) {
    Toast.show('确认数字不匹配，已取消批量删除');
    return;
  }

  const token = await requestAdminToken();
  if (!token) return;

  $('bulkDelete').disabled = true;
  $('bulkDelete').textContent = '删除中...';

  const deletedPaths = [];
  const failed = [];
  for (const item of items) {
    try {
      await deleteR2Path(item.path, token);
      deletedPaths.push(item.path);
    } catch (error) {
      failed.push({ path: item.path, error });
      if (error.status === 401) break;
    }
  }

  for (const path of deletedPaths) {
    state.deletedR2Paths.add(path);
    state.selectedR2Paths.delete(path);
  }
  saveDeletedR2Paths();
  if (deletedPaths.length) {
    const deletedSet = new Set(deletedPaths);
    state.items = state.items.filter((item) => !(item.source === 'r2' && deletedSet.has(item.path)));
  }

  updateFolderOptions();
  renderStats();
  render();

  if (failed.some((item) => item.error.status === 401)) {
    Toast.show(`删除口令错误，已删除 ${deletedPaths.length} 个，剩余未删除`);
    return;
  }
  if (failed.length) {
    Toast.show(`已删除 ${deletedPaths.length} 个，失败 ${failed.length} 个`);
    return;
  }
  Toast.show(`已删除 ${deletedPaths.length} 个 R2 文件`);
}

function rememberAdminToken(token) {
  state.adminToken = token.trim();
  if (state.adminToken) localStorage.setItem(ADMIN_TOKEN_KEY, state.adminToken);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
  updateAdminTokenStatus();
}

function clearAdminToken() {
  state.adminToken = '';
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  updateAdminTokenStatus();
}

function updateAdminTokenStatus() {
  const control = $('adminTokenControl');
  const hasToken = Boolean(state.adminToken.trim());
  control.textContent = hasToken ? '删除口令：已设置' : '删除口令：点击设置';
  control.classList.toggle('saved', hasToken);
}

async function requestAdminToken() {
  if (state.adminToken.trim()) return state.adminToken;

  return new Promise((resolve) => {
    Modal.prompt('设置删除口令', '请输入 R2 删除口令，该口令将仅保存在您的浏览器本地。', 'R2 删除口令', (token) => {
      if (token.trim()) {
        rememberAdminToken(token);
        resolve(state.adminToken);
      } else {
        resolve('');
      }
    }, { inputType: 'password', autocomplete: 'current-password' });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

async function boot() {
  try {
    const data = await fetch('./data/assets.json').then((res) => res.json());
    window.galleryGeneratedAt = data.generatedAt;
    state.r2NonImagesTotal = data.sources.r2.nonImagesTotal;
    state.items = data.items.filter((item) => !(item.source === 'r2' && state.deletedR2Paths.has(item.path)));
    
    updateAdminTokenStatus();
    renderStats();
    setupFilters(state.items);
    render();
  } catch (error) {
    $('meta').textContent = `加载失败：${error.message}`;
  }
}

// Events
$('search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
$('source').addEventListener('change', (e) => { state.source = e.target.value; updateFolderOptions(); render(); });
$('folder').addEventListener('change', (e) => { state.folder = e.target.value; render(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
$('selectVisibleR2').addEventListener('click', () => {
  for (const item of visibleR2Items()) state.selectedR2Paths.add(item.path);
  render();
});
$('clearSelection').addEventListener('click', () => {
  state.selectedR2Paths.clear();
  render();
});
$('bulkDelete').addEventListener('click', handleBulkDelete);
$('adminTokenControl').addEventListener('click', () => {
  if (state.adminToken.trim()) {
    Modal.confirm('清除口令', '确认清除本机保存的删除口令吗？', () => clearAdminToken());
  } else {
    requestAdminToken();
  }
});

document.addEventListener('DOMContentLoaded', boot);
