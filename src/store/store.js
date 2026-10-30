import Vue from "vue";
import Vuex from "vuex";
import evalSeed from "../assets/eval_seed.json";
import config from "../assets/config.js";

Vue.use(Vuex);

// 矿区与数据源统一来自 config.js，新增矿区无需改动本文件
const MINE_NAMES = config.mineNames();
const SENSOR_NAMES = config.sensorIds();

function createEmptyFormData() {
  return {
    FVC: null,
    FVCWeight: null,
    VRI: null,
    VRIWeight: null,
    NDMI: null,
    NDMIWeight: null,
    NDSI: null,
    NDSIWeight: null,
    RSEI: null,
    RSEIWeight: null,
    environmentalCoordination: "",
    Soilpollution: "",
    year: "",
    restorationGrade: "",
    totalScore: null,
    metricLayers: {},
    metricMeans: {}
  };
}

function readStoredValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`读取本地数据失败，已使用默认值：${key}`, error);
    return fallback;
  }
}

/** 与 readStoredValue 的区别：键不存在时返回 null，用于区分「从未写过」和「写过但为空」。 */
function readStoredValueOrNull(key) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return null;
    return JSON.parse(value);
  } catch (error) {
    console.warn(`读取本地数据失败：${key}`, error);
    return null;
  }
}

function createMineState(mineName) {
  // 结果表按「矿区 + 数据源」分别存储，切换数据源即可看到各自独立的结果。
  const tableData = {};
  SENSOR_NAMES.forEach(sensorName => {
    const key = `tableData_${mineName}_${sensorName}`;
    const stored = readStoredValueOrNull(key);
    // 本地从未存过该组合时，用内置的批量计算结果初始化；
    // 一旦用户新增或删除过记录，就以 localStorage 为准，不再回填。
    const initial = stored === null
      ? ((evalSeed && evalSeed[`${mineName}_${sensorName}`]) || [])
      : stored;
    tableData[sensorName] = sortTableDataByYear(initial);
  });

  return {
    formData: {
      ...createEmptyFormData(),
      ...readStoredValue(`formData_${mineName}`, {})
    },
    tableData
  };
}

function getCurrentMine(state) {
  return state.mines[state.selectedMine];
}

function getCurrentSensor(state) {
  const sensor = state.selectedSensor;
  return SENSOR_NAMES.indexOf(sensor) >= 0 ? sensor : SENSOR_NAMES[0];
}

/** 取当前「矿区 + 数据源」对应的结果表，不存在时按空表处理。 */
function currentTableData(state) {
  const mine = getCurrentMine(state);
  if (!mine) return [];
  const sensor = getCurrentSensor(state);
  return mine.tableData[sensor] || [];
}

function persistFormData(mineName, formData) {
  localStorage.setItem(`formData_${mineName}`, JSON.stringify(formData));
}

function persistTableData(mineName, sensorName, tableData) {
  localStorage.setItem(
    `tableData_${mineName}_${sensorName}`,
    JSON.stringify(tableData)
  );
}

/**
 * 按年份倒序排列结果表：最新年份永远排在最前。
 * 年份相同的记录按录入顺序稳定排列（不改变先后）。
 */
function sortTableDataByYear(tableData) {
  return tableData
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const yearA = Number(a.item && a.item.year);
      const yearB = Number(b.item && b.item.year);
      const validA = Number.isFinite(yearA) ? yearA : -Infinity;
      const validB = Number.isFinite(yearB) ? yearB : -Infinity;
      if (validA !== validB) return validB - validA;
      return a.index - b.index;
    })
    .map(entry => entry.item);
}

const mines = MINE_NAMES.reduce((result, mineName) => {
  result[mineName] = createMineState(mineName);
  return result;
}, {});

export default new Vuex.Store({
  state: {
    map: null,
    selectedMine: MINE_NAMES[0],
    // 默认数据源保持为 Sentinel-2（评价模块历史默认值），与配置里声明的顺序无关
    selectedSensor: config.sensors.some(item => item.id === 'sentinel2')
      ? 'sentinel2'
      : SENSOR_NAMES[0],
    // 当前地图上最近加载的指标图层，用于右下角图例联动
    // 形如 { key: 'fvc', layerName: '2026_mine1_FVC_sentinel2' }，清除图层时置空
    activeLegend: null,
    mines
  },

  mutations: {
    setMap(state, map) {
      state.map = map;
    },

    setActiveLegend(state, payload) {
      if (!payload || !payload.key) {
        state.activeLegend = null;
        return;
      }
      state.activeLegend = { key: payload.key, layerName: payload.layerName || '' };
    },

    setSelectedMine(state, mine) {
      if (state.mines[mine]) {
        state.selectedMine = mine;
      }
    },

    setSelectedSensor(state, sensor) {
      if (SENSOR_NAMES.indexOf(sensor) >= 0) {
        state.selectedSensor = sensor;
      }
    },

    updateFormData(state, payload) {
      const mineName = state.selectedMine;
      const mine = getCurrentMine(state);
      if (!mine) return;

      mine.formData = { ...mine.formData, ...payload };
      persistFormData(mineName, mine.formData);
    },

    addTableData(state) {
      const mineName = state.selectedMine;
      const sensorName = getCurrentSensor(state);
      const mine = getCurrentMine(state);
      if (!mine) return;

      const record = JSON.parse(JSON.stringify(mine.formData));
      // 记录所用数据源，便于回显与溯源。
      record.sensor = sensorName;

      if (!mine.tableData[sensorName]) {
        mine.tableData[sensorName] = [];
      }
      mine.tableData[sensorName] = sortTableDataByYear(
        mine.tableData[sensorName].concat([record])
      );
      persistTableData(mineName, sensorName, mine.tableData[sensorName]);
    },

    deleteTableData(state, index) {
      const mineName = state.selectedMine;
      const sensorName = getCurrentSensor(state);
      const mine = getCurrentMine(state);
      const list = currentTableData(state);
      if (!mine || !Number.isInteger(index) || index < 0 || index >= list.length) return;

      mine.tableData[sensorName].splice(index, 1);
      persistTableData(mineName, sensorName, mine.tableData[sensorName]);
    },

    resetFormData(state) {
      const mineName = state.selectedMine;
      const mine = getCurrentMine(state);
      if (!mine) return;

      mine.formData = createEmptyFormData();
      persistFormData(mineName, mine.formData);
    }
  },

  actions: {
    setSelectedMine({ commit }, mine) {
      commit("setSelectedMine", mine);
    },
    setSelectedSensor({ commit }, sensor) {
      commit("setSelectedSensor", sensor);
    }
  },

  getters: {
    getSelectedMine(state) {
      return state.selectedMine;
    },

    getSelectedSensor(state) {
      return getCurrentSensor(state);
    },

    getActiveLegend(state) {
      return state.activeLegend;
    },

    // 结果表随「矿区 + 数据源」联动切换
    getTableData(state) {
      return currentTableData(state);
    }
  }
});
