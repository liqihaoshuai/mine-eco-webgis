const USERS_KEY = 'mine_eco_users';
const SESSION_KEY = 'mine_eco_current_user';

const DEFAULT_ADMIN = {
  id: 'admin-001',
  username: 'admin',
  displayName: '系统管理员',
  role: 'admin',
  email: 'admin@example.com',
  mobile: '13800000000',
  status: 'active',
  createdAt: '2026-01-01T08:00:00.000Z',
  lastLoginAt: null,
  password: '123456'
};

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function withoutPassword(user) {
  if (!user) return null;
  const result = { ...user };
  delete result.password;
  return result;
}

function normalizeUsers(users) {
  const list = (Array.isArray(users) ? users : []).map(item => {
    if (!item) return item;
    // 自助注册的账号不允许是管理员：历史数据若存在越权注册的管理员，
    // 读取时统一降级为普通用户，避免前端绕过注册表单直接写入 role=admin。
    if (item.source === 'self-register' && item.role === 'admin') {
      return { ...item, role: 'user' };
    }
    return item;
  });
  const hasAdmin = list.some(item => item && item.username === DEFAULT_ADMIN.username);
  return hasAdmin ? list : [DEFAULT_ADMIN].concat(list);
}

export function getUsers() {
  const users = normalizeUsers(readJson(USERS_KEY, []));
  writeJson(USERS_KEY, users);
  return users;
}

function saveUsers(users) {
  writeJson(USERS_KEY, users);
  return users;
}

export function getCurrentUser() {
  return readJson(SESSION_KEY, null);
}

export function setCurrentUser(user) {
  const safeUser = withoutPassword(user);
  writeJson(SESSION_KEY, safeUser);
  return safeUser;
}

export function clearCurrentUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function authenticate(identifier, password) {
  const value = String(identifier || '').trim().toLowerCase();
  const users = getUsers();
  const user = users.find(item => {
    if (!item) return false;
    return [item.username, item.email, item.mobile]
      .filter(Boolean)
      .some(field => String(field).toLowerCase() === value);
  });

  if (!user || user.password !== password) {
    return { ok: false, message: '账号或密码不正确' };
  }
  if (user.status !== 'active') {
    return { ok: false, message: '该账号已停用，请联系管理员' };
  }

  user.lastLoginAt = new Date().toISOString();
  saveUsers(users);
  return { ok: true, user: setCurrentUser(user) };
}

export function registerUser(payload) {
  const users = getUsers();
  const username = String(payload.username || '').trim();
  const duplicate = users.some(item => item && item.username.toLowerCase() === username.toLowerCase());
  if (duplicate) {
    return { ok: false, message: '该账号已经注册，请更换账号' };
  }

  const user = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username,
    displayName: String(payload.displayName || username).trim(),
    // 自助注册固定为普通用户，忽略调用方传入的任何 role 值。
    role: 'user',
    source: 'self-register',
    email: String(payload.email || '').trim(),
    mobile: String(payload.mobile || '').trim(),
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    password: payload.password
  };

  users.push(user);
  saveUsers(users);
  return { ok: true, user: withoutPassword(user) };
}

export function createUser(payload) {
  const users = getUsers();
  const username = String(payload.username || '').trim();
  if (!username) return { ok: false, message: '账号不能为空' };
  if (users.some(item => item && item.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, message: '该账号已经存在' };
  }
  const user = {
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username,
    displayName: String(payload.displayName || username).trim(),
    role: payload.role === 'admin' ? 'admin' : 'user',
    source: 'admin-console',
    email: String(payload.email || '').trim(),
    mobile: String(payload.mobile || '').trim(),
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    password: payload.password || '123456'
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user: withoutPassword(user) };
}

export function updateUser(id, patch) {
  const users = getUsers();
  const index = users.findIndex(item => item && item.id === id);
  if (index < 0) return { ok: false, message: '用户不存在' };

  const current = users[index];
  const next = {
    ...current,
    ...patch,
    username: current.username,
    role: patch.role === 'admin' ? 'admin' : (patch.role === 'user' ? 'user' : current.role),
    status: patch.status === 'disabled' ? 'disabled' : (patch.status === 'active' ? 'active' : current.status)
  };
  // 由管理员在用户管理中授予管理员权限后，账号来源改为 admin-console，
  // 避免读取时被“自助注册账号不得为管理员”的规则再次降级。
  if (next.role === 'admin') {
    next.source = 'admin-console';
  }
  if (patch.password === undefined || patch.password === '') {
    next.password = current.password;
  }
  users.splice(index, 1, next);
  saveUsers(users);

  const session = getCurrentUser();
  if (session && session.id === id) {
    setCurrentUser(next);
  }
  return { ok: true, user: withoutPassword(next) };
}

export function deleteUser(id) {
  const users = getUsers();
  const target = users.find(item => item && item.id === id);
  if (!target) return { ok: false, message: '用户不存在' };
  if (target.username === DEFAULT_ADMIN.username) {
    return { ok: false, message: '系统管理员账号不能删除' };
  }

  saveUsers(users.filter(item => item.id !== id));
  return { ok: true };
}

export function roleLabel(role) {
  return role === 'admin' ? '管理员' : '普通用户';
}

export function statusLabel(status) {
  return status === 'disabled' ? '已停用' : '正常';
}

export function formatUserTime(value) {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
