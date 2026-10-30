// 影像数据根目录（【后端所在机器】上的绝对路径）
// ⚠️ 维护点：数据目录调整时只改这一行，所有组件自动跟随。
const DATA_DIR = 'D:\\webgis\\02 数据库\\数据';
const RAW_DIR = DATA_DIR + '\\原始数据';

// 评价数据里的年份参与“系统中出现过的年份”合并，
// 这样批量计算 + 生成种子后，新增年份无需再改本文件。
import evalSeed from './eval_seed.json';

export default {
  // ===================== 业务主体清单（唯一维护点） =====================
  // 新增矿区时只在这里追加一项，下列位置会自动跟随：
  //   矿区查看 / 各指标计算 / 评价模块的下拉框、大屏排名与 KPI、
  //   结果表存储键、矿区裁剪面与影像输出目录。
  mines: [
    { id: 'mine1', name: '矿区1' },
    { id: 'mine2', name: '矿区2' },
    { id: 'mine3', name: '矿区3' },
  ],
  // 数据源同样只维护这一处；optionLabel 用于下拉框，label 用于图表与标题
  sensors: [
    { id: 'landsat89', label: 'Landsat 8/9', optionLabel: 'Landsat 8/9' },
    { id: 'sentinel2', label: 'Sentinel-2', optionLabel: '哨兵二号 Sentinel-2' },
  ],
  mineNames() {
    return (this.mines || []).map(item => item.name);
  },
  mineIds() {
    return (this.mines || []).map(item => item.id);
  },
  sensorIds() {
    return (this.sensors || []).map(item => item.id);
  },

  // GeoServer 服务地址
  geoServerWMS: 'http://localhost:8081/geoserver/webgis/wms',
  geoServerWFS: 'http://localhost:8081/geoserver/webgis/wfs',

  // ===================== 后端影像数据路径 =====================
  // 前端不传输文件本身，只把“路径字符串”发给后端；后端在本机用 rasterio
  // 按绝对路径打开栅格，所以此处填的是【后端所在机器】上的路径。
  dataDir: DATA_DIR,

  // 兼容旧版“按一个矢量文件统计全部矿区”的接口。
  // 当前按年份/矿区生成的专题结果会直接使用投影裁剪栅格统计，通常不会依赖此配置。
  // 该文件包含 mine1、mine2、mine3 三个矿区面，名称字段为 name。
  mineAreaPath: RAW_DIR + '\\矿区矢量数据\\矿区范围.shp',
  mineNameField: 'name',

  // 矿区查看：按年份读取后端所在机器上的原始栅格目录。
  // 未得到真实数据目录前不填虚假路径；可按年份直接配置，也可配置统一根目录。
  // 示例：2019: 'D:\\data\\mine\\2019'
  mineRasterRoot: '',
  // 静态兜底年份：正常年份由 eval_seed.json 里的评价记录自动推导，
  // 这里只在完全没有评价数据时用于占位，新增年份不必改这一行。
  declaredYears: [2020, 2024, 2026],
  /**
   * 系统中出现过的全部年份（升序）。
   * 来源 = 静态兜底年份 ∪ 评价数据中实际出现过的年份。
   * 因此跑完批量计算并重新生成 eval_seed.json 后，新年份自动出现在所有下拉框。
   */
  availableYears() {
    const set = new Set();
    (this.declaredYears || []).forEach(item => {
      const year = Number(item);
      if (Number.isFinite(year)) set.add(year);
    });
    Object.keys(evalSeed || {}).forEach(key => {
      (evalSeed[key] || []).forEach(row => {
        const year = Number(row && row.year);
        if (Number.isFinite(year)) set.add(year);
      });
    });
    return Array.from(set).sort((a, b) => a - b);
  },
  /**
   * 系统记录中的最新年份，作为各选择框的默认值。
   * 取自 availableYears() 的最大值，新增年份自动跟随。
   */
  latestYear() {
    const years = this.availableYears();
    return years.length ? years[years.length - 1] : new Date().getFullYear();
  },
  // 原始影像按年份分目录：原始数据\<年份>\<数据源>_<年份>.tif
  // 个别年份目录名不一致时，在此按年份单独覆盖即可。
  mineRasterSourceRoot: RAW_DIR,
  mineRasterSourceDirs: {},
  mineDemPath: RAW_DIR + '\\DEM.tif',
  mineRasterOutputDir: DATA_DIR + '\\矿区查看',
  // 评价指标统一读取矿区查看模块生成的年度/矿区裁剪栅格。
  // 目录结构：mineRasterOutputDir\\年份\\矿区编号\\*.tif
  mineRasterOutputRoot: DATA_DIR + '\\矿区查看',
  mineTargetCrs: 'EPSG:3857',
  mineRasterSourceDir(year) {
    const value = Number(year);
    const override = this.mineRasterSourceDirs[value];
    if (override) return override;
    if (this.mineRasterRoot) return `${this.mineRasterRoot}\\${value}`;
    return `${this.mineRasterSourceRoot}\\${value}`;
  },
  // 评价指标输入目录：只读取矿区查看模块已经投影、裁剪后的年度矿区目录。
  mineRasterProcessedDir(year, mineId) {
    const value = Number(year);
    const id = String(mineId || '').replace('矿区', 'mine');
    return `${this.mineRasterOutputRoot}\\${value}\\${id}`;
  },
  mineProcessedRaster(year, mineId, sourcePath) {
    const value = Number(year);
    const id = String(mineId || '').replace('矿区', 'mine');
    const sourceName = String(sourcePath || '').split(/[\\\\/]/).pop();
    const stem = sourceName.replace(/\.(tif|tiff)$/i, '');
    return `${this.mineRasterProcessedDir(value, id)}\\${stem}_${value}_${id}_clipped.tif`;
  },
  // 各矿区裁剪面路径：按矿区编号自动拼装，形如 矿区矢量数据\kuangqv_1.shp。
  // 个别矿区的文件名不符合约定时，在 mineClipPaths 中单独覆盖即可。
  mineClipDir: RAW_DIR + '\\矿区矢量数据',
  mineClipPaths: {},
  mineClipPath(mineId) {
    const id = String(mineId || '');
    const override = this.mineClipPaths[id];
    if (override) return override;
    const index = id.replace(/^mine/i, '');
    if (!index) return '';
    return `${this.mineClipDir}\\kuangqv_${index}.shp`;
  },
  mineLayer(mineId, year) {
    return `webgis:kuangqv_${mineId.replace('mine', '')}_${year}`;
  },
  terrainLayer(mineId, year, operation) {
    return `webgis:${operation}_${year}_${mineId}_from_dem`;
  },
  slopeLayer(mineId, year) {
    return this.terrainLayer(mineId, year, 'slope');
  },
  aspectLayer(mineId, year) {
    return this.terrainLayer(mineId, year, 'aspect');
  },
  elevationLayer(mineId, year) {
    return this.terrainLayer(mineId, year, 'elevation');
  },

  // 拼接栅格文件完整路径，用法：config.raster('kuangshan2024.tif')
  // 子目录直接用反斜杠，如 config.raster('rsei\\2024band1_11.tif')
  raster(name) {
    return DATA_DIR + '\\' + name;
  },

  // 年度影像路径约定；若实际文件名不同，只需修改这里。
  landsatRaster(year) {
    const value = Number(year);
    return `${this.mineRasterSourceDir(value)}\\landsat89_${value}.tif`;
  },
  sentinelRaster(year) {
    const value = Number(year);
    return `${this.mineRasterSourceDir(value)}\\sentinel2_${value}.tif`;
  },
  landsatVriRaster(year) {
    return this.landsatRaster(year);
  },
  sentinelVriRaster(year) {
    return this.sentinelRaster(year);
  },

};
