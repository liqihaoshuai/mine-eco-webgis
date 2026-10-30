/**
 * 大屏与评价模块共用的评价数据读取层。
 *
 * 数据来源有两层：
 *   1. 构建时内置的 eval_seed.json（批量计算脚本生成的初始成果）
 *   2. 浏览器 localStorage 里的 tableData_<矿区>_<数据源>
 *      （用户在“矿区生态修复效果评估”模块新增/编辑/删除后的实时结果）
 *
 * 规则：localStorage 中存在该「矿区 + 数据源」组合时以本地为准，
 * 否则回退到种子数据。这样大屏既能展示初始成果，也能跟随评价模块的修改。
 *
 * 矿区列表不写死：既从种子键名解析，也扫描 localStorage 中已存在的组合，
 * 因此新增矿区后无需修改大屏代码即可出现在排名、KPI 与等级分布中。
 */
import evalSeed from './eval_seed.json';
import config from './config.js';

// 数据源清单统一来自 config.js，新增数据源无需改本文件
export const SENSOR_NAMES = config.sensorIds();

export const SENSOR_LABELS = (config.sensors || []).reduce((result, item) => {
  result[item.id] = item.label;
  return result;
}, {});

const TABLE_PREFIX = 'tableData_';
// 键名形如 矿区1_sentinel2，后缀允许的数据源由 config 动态生成
const KEY_PATTERN = new RegExp(`^(.+)_(${SENSOR_NAMES.join('|')})$`);
// 完全没有任何评价数据时的兜底矿区列表，与 config.js 的矿区清单保持一致
const DEFAULT_MINES = config.mineNames();

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (error) {
    console.warn(`读取本地评价数据失败：${key}`, error);
    return null;
  }
}

/** 把 "矿区1_sentinel2" 解析成 { mine: '矿区1', sensor: 'sentinel2' } */
export function parseDataKey(key) {
  const match = KEY_PATTERN.exec(String(key || ''));
  if (!match) return null;
  return { mine: match[1], sensor: match[2] };
}

/** 收集所有出现过评价记录的矿区名称，按自然顺序（矿区2 排在 矿区10 之前） */
export function collectMineNames(dataset) {
  const names = new Set();

  Object.keys(dataset || {}).forEach(key => {
    const parsed = parseDataKey(key);
    if (parsed) names.add(parsed.mine);
  });

  // localStorage 中可能已有种子文件里没有的新矿区
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key.indexOf(TABLE_PREFIX) !== 0) continue;
      const parsed = parseDataKey(key.slice(TABLE_PREFIX.length));
      if (parsed) names.add(parsed.mine);
    }
  } catch (error) {
    console.warn('扫描本地矿区列表失败', error);
  }

  // 兜底：完全没有评价数据时，用默认矿区列表，避免大屏空白
  if (!names.size) {
    DEFAULT_MINES.forEach(name => names.add(name));
  }

  return Array.from(names).sort((a, b) =>
    String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true })
  );
}

/** 合并种子数据与本地实时数据，返回 { '矿区1_sentinel2': [...] } 结构 */
export function loadEvalDataset() {
  const dataset = {};
  Object.keys(evalSeed || {}).forEach(key => {
    dataset[key] = Array.isArray(evalSeed[key]) ? evalSeed[key].slice() : [];
  });

  collectMineNames(dataset).forEach(mine => {
    SENSOR_NAMES.forEach(sensor => {
      const key = `${TABLE_PREFIX}${mine}_${sensor}`;
      const stored = readJson(key);
      // null 表示从未写入，保留种子；空数组表示用户删空了，按空处理
      if (stored !== null) {
        dataset[`${mine}_${sensor}`] = Array.isArray(stored) ? stored : [];
      }
    });
  });

  return dataset;
}

/** 取某个「矿区 + 数据源」的全部记录 */
export function recordsOf(dataset, mine, sensor) {
  return (dataset && dataset[`${mine}_${sensor}`]) || [];
}

/** 取某个「矿区 + 数据源 + 年份」的单条记录 */
export function recordOf(dataset, mine, sensor, year) {
  return (
    recordsOf(dataset, mine, sensor).find(
      item => String(item.year) === String(year)
    ) || null
  );
}
