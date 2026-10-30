/**
 * 评价结果检验的计算层。
 *
 * 数据来源与评价模块一致（evalData 合并后的记录），
 * 所有指标打分规则与 Evaluate.vue 的 mapXxxToScore 保持一致，
 * 避免检验模块和评分模块各用一套标准。
 */
import minesGeo from './mines.geo.json';
import config from './config.js';

export const INDICATORS = [
  { key: 'FVC', label: '植被覆盖度 FVC', weightKey: 'FVCWeight' },
  { key: 'VRI', label: '植被恢复指数 VRI', weightKey: 'VRIWeight' },
  { key: 'NDMI', label: '土壤湿度 NDMI', weightKey: 'NDMIWeight' },
  { key: 'NDSI', label: '裸土指数 NDSI', weightKey: 'NDSIWeight' },
  { key: 'RSEI', label: '遥感生态指数 RSEI', weightKey: 'RSEIWeight' },
];

export const GRADES = ['优秀', '良好', '中等', '较差'];

export const GRADE_COLORS = {
  优秀: '#1a9850',
  良好: '#66bd63',
  中等: '#fee08b',
  较差: '#d73027',
};

/** 权重和与 1 的最大允许偏差 */
const WEIGHT_TOLERANCE = 0.001;

function round(value, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(Number(value) * factor) / factor;
}

function mapRangeToScore(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return round(((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin, 2);
}

function mapByRanges(value, ranges) {
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (value >= range[0] && value <= range[1]) {
      return mapRangeToScore(value, range[0], range[1], range[2], range[3]);
    }
  }
  // 超出范围时取最近端点，避免返回 0 造成断崖
  if (value < ranges[0][0]) return ranges[0][2];
  if (value > ranges[ranges.length - 1][1]) return ranges[ranges.length - 1][3];
  return 0;
}

/** 与 Evaluate.vue 完全一致的指标打分规则 */
export function scoreOf(key, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (key === 'FVC') {
    return mapByRanges(number, [
      [0, 10, 0, 20], [10, 30, 21, 40], [30, 50, 41, 60],
      [50, 70, 61, 80], [70, 100, 81, 100],
    ]);
  }
  if (key === 'VRI' || key === 'NDMI') {
    return mapByRanges(number, [
      [-1, -0.3, 0, 40], [-0.3, 0.3, 41, 60],
      [0.3, 0.7, 61, 80], [0.7, 1, 80, 100],
    ]);
  }
  if (key === 'NDSI') {
    if (number <= -0.5) return 100;
    if (number <= 0) return round(80 - ((number + 0.5) / 0.5) * 20, 2);
    if (number <= 0.5) return round(60 - (number / 0.5) * 20, 2);
    return 40;
  }
  if (key === 'RSEI') {
    return mapByRanges(number, [
      [0.8, 1, 90, 100], [0.6, 0.8, 70, 90],
      [0.3, 0.6, 61, 70], [0, 0.3, 0, 60],
    ]);
  }
  return null;
}

export function gradeOf(score) {
  if (!Number.isFinite(Number(score))) return '';
  const value = Number(score);
  if (value >= 80) return '优秀';
  if (value >= 70) return '良好';
  if (value >= 60) return '中等';
  return '较差';
}

/** 把 { '矿区1_sentinel2': [...] } 拉平成带矿区、数据源的记录数组 */
export function flattenRecords(dataset, mineNames) {
  const list = [];
  (mineNames || []).forEach(mine => {
    config.sensorIds().forEach(sensor => {
      (dataset[`${mine}_${sensor}`] || []).forEach(row => {
        list.push(Object.assign({}, row, {
          mine: mine,
          sensor: sensor,
          year: Number(row.year),
        }));
      });
    });
  });
  return list;
}

/** 按权重与指标得分重算综合分（用于敏感性分析） */
export function totalScoreWith(record, weightPatch) {
  let total = 0;
  INDICATORS.forEach(item => {
    const score = scoreOf(item.key, record[item.key]);
    const weight = weightPatch && weightPatch[item.key] !== undefined
      ? weightPatch[item.key]
      : Number(record[item.weightKey] || 0);
    if (score !== null) total += score * weight;
  });
  return round(total, 2);
}

/** 单条记录的指标贡献（加权得分） */
export function contributionOf(record) {
  return INDICATORS.map(item => {
    const score = scoreOf(item.key, record[item.key]);
    const weight = Number(record[item.weightKey] || 0);
    return {
      key: item.key,
      label: item.label,
      score: score,
      weight: weight,
      points: score === null ? 0 : round(score * weight, 2),
    };
  });
}

/* --------------------------- 矿区面积 --------------------------- */

function ringAreaKm2(ring) {
  const earthRadius = 6371.0088;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    const lon1 = (current[0] * Math.PI) / 180;
    const lon2 = (next[0] * Math.PI) / 180;
    const lat1 = (current[1] * Math.PI) / 180;
    const lat2 = (next[1] * Math.PI) / 180;
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((total * earthRadius * earthRadius) / 2);
}

/** 矿区面积表：{ 矿区1: { km2, mu } }，1 km² = 1500 亩 */
export function mineAreaMap() {
  const result = {};
  const features = (minesGeo && minesGeo.features) || [];
  features.forEach(feature => {
    const props = feature.properties || {};
    const name = props.mine || props.mine_id;
    if (!name || !feature.geometry) return;
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : (feature.geometry.coordinates || []);
    let km2 = 0;
    polygons.forEach(polygon => {
      if (!polygon || !polygon.length) return;
      km2 += ringAreaKm2(polygon[0]);
      // 内环（如果有）需要扣减
      for (let i = 1; i < polygon.length; i += 1) {
        km2 -= ringAreaKm2(polygon[i]);
      }
    });
    result[name] = { km2: round(km2, 4), mu: Math.round(km2 * 1500) };
  });
  return result;
}

/* --------------------------- 自洽性检查 --------------------------- */

const DOMAIN = {
  FVC: [0, 100],
  VRI: [-1, 1],
  NDMI: [-1, 1],
  NDSI: [-1, 1],
  RSEI: [0, 1],
};

export function auditIssues(records) {
  const issues = [];
  const push = (level, mine, sensor, year, message) => {
    issues.push({ level, mine, sensor, year, message });
  };

  records.forEach(record => {
    const { mine, sensor, year } = record;

    // 1) 权重和是否为 1
    const weightSum = INDICATORS.reduce(
      (sum, item) => sum + Number(record[item.weightKey] || 0), 0
    );
    if (Math.abs(weightSum - 1) > WEIGHT_TOLERANCE) {
      push('error', mine, sensor, year, `权重之和为 ${round(weightSum, 3)}，应为 1.000`);
    }

    // 2) 指标取值是否在定义域内
    INDICATORS.forEach(item => {
      const value = Number(record[item.key]);
      const range = DOMAIN[item.key];
      if (!Number.isFinite(value)) {
        push('error', mine, sensor, year, `${item.key} 缺失`);
      } else if (value < range[0] || value > range[1]) {
        push('error', mine, sensor, year, `${item.key}=${value} 超出取值范围 [${range[0]}, ${range[1]}]`);
      }
    });

    // 3) 存储的得分与等级是否匹配
    const total = Number(record.totalScore);
    const expected = gradeOf(total);
    if (!Number.isFinite(total)) {
      push('error', mine, sensor, year, '综合得分为空');
    } else if (expected && record.restorationGrade && expected !== record.restorationGrade) {
      push('error', mine, sensor, year, `得分 ${total} 按阈值应为「${expected}」，记录却是「${record.restorationGrade}」`);
    }

    // 4) 重算得分与记录得分是否一致
    const recomputed = totalScoreWith(record);
    if (Number.isFinite(total) && Math.abs(recomputed - total) > 0.05) {
      push('warn', mine, sensor, year, `按当前指标与权重重算得分为 ${recomputed}，与记录值 ${total} 不一致`);
    }
  });

  // 5) 同矿区同数据源的年度趋势与指标背离
  const groups = {};
  records.forEach(record => {
    const key = `${record.mine}_${record.sensor}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  });
  Object.keys(groups).forEach(key => {
    const list = groups[key].slice().sort((a, b) => a.year - b.year);
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const current = list[i];
      const prevScore = Number(prev.totalScore);
      const currentScore = Number(current.totalScore);
      if (!Number.isFinite(prevScore) || !Number.isFinite(currentScore)) continue;

      if (currentScore < prevScore) {
        push('warn', current.mine, current.sensor, current.year,
          `得分由 ${prev.year} 年 ${prevScore} 降至 ${currentScore}，未体现修复改善趋势`);
      } else if (currentScore > prevScore) {
        const fvcPrev = scoreOf('FVC', prev.FVC);
        const fvcNow = scoreOf('FVC', current.FVC);
        const ndsiPrev = scoreOf('NDSI', prev.NDSI);
        const ndsiNow = scoreOf('NDSI', current.NDSI);
        if (fvcPrev !== null && fvcNow !== null && fvcNow < fvcPrev
          && ndsiPrev !== null && ndsiNow !== null && ndsiNow < ndsiPrev) {
          push('warn', current.mine, current.sensor, current.year,
            `总分上升但 FVC 与 NDSI 得分同时下降，改善主要由 RSEI 拉动`);
        }
      }
    }
  });

  return issues;
}

/* --------------------------- 等级面积与转移 --------------------------- */

export function gradeAreaByYear(records, years) {
  const areas = mineAreaMap();
  return years.map(year => {
    const row = { year: year, total: 0, detail: [] };
    const counts = {};
    GRADES.forEach(grade => {
      row[grade] = 0;
      counts[grade] = 0;
    });
    records.filter(item => item.year === Number(year)).forEach(record => {
      const area = areas[record.mine];
      const grade = record.restorationGrade;
      if (!area || !grade || row[grade] === undefined) return;
      row[grade] += area.mu;
      counts[grade] += 1;
      row.total += area.mu;
      row.detail.push({
        mine: record.mine,
        grade: grade,
        mu: area.mu,
        score: record.totalScore,
      });
    });
    row.counts = counts;
    return row;
  });
}

export function transitionMatrix(records, years, mineNames) {
  const areas = mineAreaMap();
  const matrix = [];
  for (let i = 1; i < years.length; i += 1) {
    const fromYear = Number(years[i - 1]);
    const toYear = Number(years[i]);
    (mineNames || []).forEach(mine => {
      const from = records.find(item => item.mine === mine && item.year === fromYear);
      const to = records.find(item => item.mine === mine && item.year === toYear);
      if (!from || !to) return;
      matrix.push({
        period: `${fromYear} → ${toYear}`,
        fromYear: fromYear,
        toYear: toYear,
        mine: mine,
        fromGrade: from.restorationGrade,
        toGrade: to.restorationGrade,
        fromScore: from.totalScore,
        toScore: to.totalScore,
        delta: round(Number(to.totalScore) - Number(from.totalScore), 2),
        mu: (areas[mine] || {}).mu || 0,
        direction: gradeRank(to.restorationGrade) - gradeRank(from.restorationGrade),
      });
    });
  }
  return matrix;
}

/** 等级序号：越大越好，用于判断提升/下降 */
export function gradeRank(grade) {
  const index = GRADES.indexOf(grade);
  return index < 0 ? 0 : GRADES.length - index;
}

export function transitionSummary(matrix) {
  const summary = { upgrade: { count: 0, mu: 0 }, same: { count: 0, mu: 0 }, downgrade: { count: 0, mu: 0 } };
  matrix.forEach(item => {
    if (item.direction > 0) {
      summary.upgrade.count += 1;
      summary.upgrade.mu += item.mu;
    } else if (item.direction < 0) {
      summary.downgrade.count += 1;
      summary.downgrade.mu += item.mu;
    } else {
      summary.same.count += 1;
      summary.same.mu += item.mu;
    }
  });
  return summary;
}

/* --------------------------- 敏感性分析 --------------------------- */

function rebalanceWeights(record, targetKey, delta) {
  const base = {};
  INDICATORS.forEach(item => {
    base[item.key] = Number(record[item.weightKey] || 0);
  });
  const target = base[targetKey] + delta;
  if (target < 0 || target > 1) return null;
  const restTotal = 1 - base[targetKey];
  const restTarget = 1 - target;
  const patch = { [targetKey]: target };
  INDICATORS.forEach(item => {
    if (item.key === targetKey) return;
    patch[item.key] = restTotal > 0 ? round((base[item.key] / restTotal) * restTarget, 6) : 0;
  });
  return patch;
}

/** 单个指标权重 ±step 比例后，等级发生变化的记录占比 */
export function weightSensitivity(records, step = 0.2) {
  return INDICATORS.map(item => {
    const result = { key: item.key, label: item.label, up: null, down: null };
    [['up', step], ['down', -step]].forEach(pair => {
      const direction = pair[0];
      const ratio = pair[1];
      let changed = 0;
      let maxDelta = 0;
      let valid = 0;
      records.forEach(record => {
        const baseWeight = Number(record[item.weightKey] || 0);
        const delta = baseWeight * ratio;
        if (Math.abs(delta) < 1e-9) return;
        const patch = rebalanceWeights(record, item.key, delta);
        if (!patch) return;
        valid += 1;
        const newScore = totalScoreWith(record, patch);
        const newGrade = gradeOf(newScore);
        if (newGrade !== record.restorationGrade) changed += 1;
        maxDelta = Math.max(maxDelta, Math.abs(newScore - Number(record.totalScore || 0)));
      });
      result[direction] = {
        changed: changed,
        total: valid,
        rate: valid ? round((changed / valid) * 100, 1) : 0,
        maxDelta: round(maxDelta, 2),
      };
    });
    return result;
  });
}

/** 分级阈值整体平移 delta 分后，等级发生变化的记录占比 */
export function thresholdSensitivity(records, delta = 5) {
  const thresholds = [80 + delta, 70 + delta, 60 + delta];
  let changed = 0;
  let valid = 0;
  const details = [];
  records.forEach(record => {
    const score = Number(record.totalScore);
    if (!Number.isFinite(score)) return;
    valid += 1;
    let grade = '较差';
    if (score >= thresholds[0]) grade = '优秀';
    else if (score >= thresholds[1]) grade = '良好';
    else if (score >= thresholds[2]) grade = '中等';
    if (grade !== record.restorationGrade) {
      changed += 1;
      details.push({
        mine: record.mine,
        sensor: record.sensor,
        year: record.year,
        score: score,
        from: record.restorationGrade,
        to: grade,
      });
    }
  });
  return {
    delta: delta,
    thresholds: thresholds,
    changed: changed,
    total: valid,
    rate: valid ? round((changed / valid) * 100, 1) : 0,
    details: details,
  };
}

export { round, WEIGHT_TOLERANCE };
