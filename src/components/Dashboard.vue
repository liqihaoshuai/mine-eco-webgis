<template>
  <div class="dashboard">
    <!-- 顶栏 -->
    <header class="db-header">
      <div class="db-brand">
        <h1>基于WebGIS的露天矿山生态修复遥感监测与综合评价系统</h1>
      </div>

      <div class="db-controls">
        <div class="db-seg db-seg-years">
          <button
            v-for="y in years"
            :key="y"
            :class="['db-seg-btn', { active: y === currentYear }]"
            @click="currentYear = y"
          >{{ y }}</button>
        </div>
        <div class="db-seg">
          <button
            v-for="s in sensorOptions"
            :key="s.value"
            :class="['db-seg-btn', { active: s.value === currentSensor }]"
            @click="currentSensor = s.value"
          >{{ s.label }}</button>
        </div>
        <button class="db-enter" @click="enterSystem">进入分析系统 →</button>
      </div>
    </header>

    <!-- 主体：左右两栏可拖拽调宽，中间地图自适应剩余空间 -->
    <main class="db-body">
      <!-- 左列 -->
      <section class="db-col db-col-left" :style="{ width: leftWidth + 'px' }">
        <div class="db-kpi-grid">
          <div class="db-kpi" v-for="k in kpiCards" :key="k.label">
            <div class="db-kpi-label">{{ k.label }}</div>
            <div class="db-kpi-value">{{ k.value }}<span v-if="k.unit" class="db-kpi-unit">{{ k.unit }}</span></div>
            <div class="db-kpi-hint">{{ k.hint }}</div>
          </div>
        </div>

        <div class="db-card db-card-grow">
          <div class="db-card-head">
            <span>年度平均修复得分</span>
            <span class="db-card-note">{{ currentSensorLabel }}</span>
          </div>
          <div ref="trendChart" class="db-chart"></div>
        </div>
      </section>

      <div
        class="db-resizer"
        :class="{ 'is-active': resizing === 'left' }"
        title="拖动调整左栏宽度，双击恢复默认"
        @mousedown.prevent="startResize('left', $event)"
        @dblclick="resetWidth('left')"
      ><span></span></div>

      <!-- 中列：地图 -->
      <section class="db-col db-col-center">
        <div class="db-card db-card-fill">
          <div class="db-card-head">
            <span>矿区分级地图 · {{ currentYear }}</span>
            <div class="db-card-tools">
              <span class="db-card-note">{{ currentSensorLabel }} · 按修复等级着色</span>
              <button
                class="db-anno-btn"
                :class="{ 'is-off': !annotationVisible }"
                :title="annotationVisible ? '隐藏天地图地名注记' : '显示天地图地名注记'"
                @click="toggleAnnotation"
              >{{ annotationVisible ? '注记 开' : '注记 关' }}</button>
            </div>
          </div>
          <div class="db-map-wrap">
            <div ref="mapBox" class="db-map"></div>
            <div class="db-legend">
              <div class="db-legend-title">修复等级</div>
              <div
                v-for="item in legendItems"
                :key="item.label"
                class="db-legend-row"
              >
                <i :style="{ background: item.color }"></i>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        class="db-resizer"
        :class="{ 'is-active': resizing === 'right' }"
        title="拖动调整右栏宽度，双击恢复默认"
        @mousedown.prevent="startResize('right', $event)"
        @dblclick="resetWidth('right')"
      ><span></span></div>

      <!-- 右列 -->
      <section class="db-col db-col-right" :style="{ width: rightWidth + 'px' }">
        <div class="db-card">
          <div class="db-card-head">
            <span>矿区综合得分</span>
            <span class="db-card-note">{{ currentYear }}</span>
          </div>
          <div class="db-rank">
            <div v-for="item in ranking" :key="item.mine" class="db-rank-row">
              <div class="db-rank-top">
                <span class="db-rank-name">{{ item.mine }}</span>
                <span class="db-rank-score">
                  {{ item.score }}
                  <em :class="['db-grade', gradeClass(item.grade)]">{{ item.grade }}</em>
                </span>
              </div>
              <div class="db-rank-bar">
                <div
                  class="db-rank-fill"
                  :style="{ width: item.percent + '%', background: gradeColor(item.grade) }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="db-card db-card-grow">
          <div class="db-card-head">
            <span>修复等级分布</span>
            <span class="db-card-note">{{ gradeNote }}</span>
          </div>
          <div ref="gradeChart" class="db-chart"></div>
        </div>

        <div class="db-card db-card-grow">
          <div class="db-card-head">
            <span>指标均值</span>
            <span class="db-card-note">{{ currentYear }} · {{ currentSensorLabel }}</span>
          </div>
          <div class="db-metrics">
            <div v-for="item in indicatorMeans" :key="item.key" class="db-metric-row">
              <div class="db-metric-top">
                <span class="db-metric-name">{{ item.label }}</span>
                <span class="db-metric-value">{{ item.value }}<em v-if="item.unit">{{ item.unit }}</em></span>
              </div>
              <div class="db-metric-bar">
                <div class="db-metric-fill" :style="{ width: item.percent + '%' }"></div>
              </div>
            </div>
            <div class="db-metrics-note">当前年份各矿区的算术平均</div>
          </div>
        </div>
      </section>
    </main>

    <footer class="db-footer">
      <span>监测矿区 {{ mines.length }} 个 · 评价年份 {{ years.join(' / ') }} · 数据源 {{ sensorOptions.length }} 种</span>
      <span>数据来源：Landsat 8/9 与 Sentinel-2 遥感影像</span>
    </footer>
  </div>
</template>

<script>
import * as echarts from 'echarts';
import L from 'leaflet';
import minesGeo from '../assets/mines.geo.json';
import { loadEvalDataset, collectMineNames } from '../assets/evalData.js';
import config from '../assets/config.js';
import { readAnnotationVisible, writeAnnotationVisible } from '../assets/preferences.js';

// 数据源清单统一来自 config.js，新增数据源无需改本文件
const SENSORS = (config.sensors || []).map(item => ({
  value: item.id,
  label: item.label,
}));
const GRADE_COLORS = {
  优秀: '#1a9850',
  良好: '#66bd63',
  中等: '#fee08b',
  较差: '#d73027',
};
const GRADES = ['优秀', '良好', '中等', '较差'];

// 左右两栏宽度：可拖拽调节，并记住上次的宽度
const COL_MIN = 210;
const COL_MAX = 480;
const COL_DEFAULT = 268;
const WIDTH_STORAGE_KEY = 'dashboard_col_widths';

function readStoredWidths() {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return { left: COL_DEFAULT, right: COL_DEFAULT };
    const parsed = JSON.parse(raw) || {};
    const clamp = v => Math.min(COL_MAX, Math.max(COL_MIN, Number(v) || COL_DEFAULT));
    return { left: clamp(parsed.left), right: clamp(parsed.right) };
  } catch (error) {
    return { left: COL_DEFAULT, right: COL_DEFAULT };
  }
}

/**
 * 从评估数据里收集所有出现过的年份，升序返回。
 *
 * 年份不再写死：只要数据里新增了某个年份的记录，
 * 大屏的年份按钮、趋势图横轴、KPI 与地图着色都会自动跟上。
 * 数据为空时回退到 config.availableYears，保证首次接入时仍有按钮可选。
 */
function collectYears(dataset) {
  const set = new Set();
  Object.keys(dataset || {}).forEach(key => {
    (dataset[key] || []).forEach(row => {
      const year = Number(row.year);
      if (Number.isFinite(year)) set.add(year);
    });
  });
  if (!set.size) {
    config.availableYears().forEach(item => {
      const year = Number(item);
      if (Number.isFinite(year)) set.add(year);
    });
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default {
  name: 'Dashboard',
  data() {
    // 合并内置成果与本地实时记录：评价模块改过的数据会立即反映到大屏
    const dataset = loadEvalDataset();
    // 矿区与年份都由数据推导，新增矿区/年份无需改本文件
    const mines = collectMineNames(dataset);
    const years = collectYears(dataset);
    const widths = readStoredWidths();
    return {
      years,
      currentYear: years.length ? years[years.length - 1] : '',
      sensorOptions: SENSORS,
      // 默认优先展示 Sentinel-2；若配置里没有则回退到第一个数据源
      currentSensor: (SENSORS.find(item => item.value === 'sentinel2') || SENSORS[0] || {}).value || '',
      dataset,
      mines,
      leftWidth: widths.left,
      rightWidth: widths.right,
      resizing: '',
      // 与主系统共用同一偏好，避免两处表现不一致
      annotationVisible: readAnnotationVisible(),
      map: null,
      geoLayer: null,
      annotationLayer: null,
      trendChart: null,
      gradeChart: null,
    };
  },
  computed: {
    currentSensorLabel() {
      const hit = SENSORS.find(item => item.value === this.currentSensor);
      return hit ? hit.label : '';
    },
    legendItems() {
      return GRADES.map(label => ({ label, color: GRADE_COLORS[label] }));
    },
    /** 当前年份 + 当前数据源下，各矿区的记录（矿区数量随数据变化） */
    yearRecords() {
      return this.mines.map(mine => {
        const list = this.dataset[`${mine}_${this.currentSensor}`] || [];
        const hit = list.find(item => String(item.year) === String(this.currentYear));
        return { mine, record: hit || null };
      });
    },
    ranking() {
      const rows = this.yearRecords
        .filter(item => item.record)
        .map(item => ({
          mine: item.mine,
          score: Number(item.record.totalScore).toFixed(1),
          grade: item.record.restorationGrade || '—',
          raw: Number(item.record.totalScore),
        }))
        .sort((a, b) => b.raw - a.raw);
      // 以最高分作为 100% 基准，避免低分矿区的柱子几乎看不见
      const max = rows.length ? Math.max(...rows.map(item => item.raw)) : 100;
      return rows.map(item => ({
        ...item,
        percent: max > 0 ? Math.max(6, (item.raw / max) * 100) : 0,
      }));
    },
    kpiCards() {
      const scores = this.yearRecords.filter(i => i.record).map(i => Number(i.record.totalScore));
      const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const good = this.yearRecords.filter(
        i => i.record && ['优秀', '良好'].includes(i.record.restorationGrade)
      ).length;
      const best = this.ranking.length ? this.ranking[0] : null;
      return [
        {
          label: '监测矿区',
          value: String(this.mines.length),
          unit: '个',
          hint: `${this.currentYear} 年 · ${scores.length} 个有评价记录`,
        },
        { label: '本年均分', value: mean ? mean.toFixed(1) : '—', unit: '', hint: `${this.currentSensorLabel}` },
        { label: '良好以上', value: String(good), unit: `/ ${scores.length}`, hint: '含优秀与良好' },
        { label: '最优矿区', value: best ? best.mine : '—', unit: '', hint: best ? `${best.score} 分` : '' },
      ];
    },
    /** 当前年份 + 数据源下的等级分布，随筛选与本地修改实时变化 */
    gradeCounts() {
      const counts = { 优秀: 0, 良好: 0, 中等: 0, 较差: 0 };
      this.yearRecords.forEach(item => {
        const grade = item.record && item.record.restorationGrade;
        if (!grade) return;
        counts[grade] = (counts[grade] || 0) + 1;
      });
      return counts;
    },
    gradeTotal() {
      return GRADES.reduce((sum, grade) => sum + (this.gradeCounts[grade] || 0), 0);
    },
    gradeNote() {
      return `${this.currentYear} 年 · ${this.currentSensorLabel} · ${this.gradeTotal} 条`;
    },
    /** 当前年份 + 数据源下，三矿区各项指标的均值 */
    indicatorMeans() {
      const defs = [
        { key: 'FVC', label: 'FVC 植被覆盖度', unit: '%', digits: 1, min: 0, max: 100 },
        { key: 'VRI', label: 'VRI 植被恢复指数', unit: '', digits: 3, min: -1, max: 1 },
        { key: 'NDMI', label: 'NDMI 土壤湿度', unit: '', digits: 3, min: -1, max: 1 },
        { key: 'NDSI', label: 'NDSI 裸土指数', unit: '', digits: 3, min: -1, max: 1 },
        { key: 'RSEI', label: 'RSEI 遥感生态指数', unit: '', digits: 3, min: 0, max: 1 },
      ];
      const records = this.yearRecords.filter(item => item.record).map(item => item.record);
      return defs.map(def => {
        const values = records
          .map(row => Number(row[def.key]))
          .filter(v => Number.isFinite(v));
        const mean = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null;
        // 位置条表示该值在指标固有量程中的相对位置，不代表好坏
        const ratio = mean === null ? 0 : (mean - def.min) / (def.max - def.min);
        return {
          key: def.key,
          label: def.label,
          unit: def.unit,
          value: mean === null ? '—' : mean.toFixed(def.digits),
          percent: Math.max(0, Math.min(100, ratio * 100)),
        };
      });
    },
  },
  watch: {
    currentYear() {
      this.updateMapStyle();
      this.renderTrend();
      this.renderGradeChart();
    },
    currentSensor() {
      this.updateMapStyle();
      this.renderTrend();
      this.renderGradeChart();
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.initMap();
      this.renderTrend();
      this.renderGradeChart();
      this.observeContainers();
      window.addEventListener('resize', this.handleResize);
    });
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.onResizeMove);
    window.removeEventListener('mouseup', this.onResizeEnd);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._mapRaf) {
      cancelAnimationFrame(this._mapRaf);
      this._mapRaf = null;
    }
    if (this.trendChart) this.trendChart.dispose();
    if (this.gradeChart) this.gradeChart.dispose();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  },
  methods: {
    gradeColor(grade) {
      return GRADE_COLORS[grade] || '#909399';
    },
    gradeClass(grade) {
      return {
        'is-good': grade === '优秀' || grade === '良好',
        'is-mid': grade === '中等',
        'is-bad': grade === '较差',
      };
    },
    enterSystem() {
      this.$router.push({ path: '/kuangqv' });
    },

    /** 显示 / 隐藏天地图地名注记，并把状态同步给主系统 */
    toggleAnnotation() {
      this.annotationVisible = !this.annotationVisible;
      const layer = this.annotationLayer;
      if (layer && this.map) {
        if (this.annotationVisible) {
          layer.addTo(this.map);
        } else {
          this.map.removeLayer(layer);
        }
      }
      writeAnnotationVisible(this.annotationVisible);
    },

    initMap() {
      if (!this.$refs.mapBox) return;
      this.map = L.map(this.$refs.mapBox, {
        crs: L.CRS.EPSG3857,
        zoomControl: false,
        attributionControl: false,
        center: [39.68, 118.74],
        zoom: 13,
      });

      // 天地图影像底图，与大屏的浅色卡片形成对比，矿区块更醒目
      L.tileLayer(
        'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510',
        { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], maxZoom: 18 }
      ).addTo(this.map);

      // 地名注记单独放一个 pane，层级高于矿区矢量面（overlayPane = 400）。
      // 否则半透明色块会把地名压暗、局部被盖住，看起来和主系统的注记不一样。
      this.map.createPane('dbAnnotationPane');
      const annoPane = this.map.getPane('dbAnnotationPane');
      annoPane.style.zIndex = 450;
      annoPane.style.pointerEvents = 'none';

      this.annotationLayer = L.tileLayer(
        'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510',
        {
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          maxZoom: 18,
          pane: 'dbAnnotationPane',
        }
      );
      // 注记开关与主系统共用同一偏好
      if (this.annotationVisible) {
        this.annotationLayer.addTo(this.map);
      }

      this.geoLayer = L.geoJSON(minesGeo, {
        style: feature => this.featureStyle(feature),
        onEachFeature: (feature, layer) => {
          const name = feature.properties.mine;
          const info = this.recordOf(name);
          layer.bindTooltip(
            `<b>${name}</b><br/>${this.currentYear} 年 · 得分 ${info ? info.totalScore : '—'}` +
            `<br/>等级 ${info ? info.restorationGrade : '无记录'}`,
            { permanent: true, direction: 'center', className: 'db-map-label' }
          );
          layer.on('click', () => {
            this.$router.push({ path: '/kuangqv' });
          });
        },
      }).addTo(this.map);

      const bounds = this.geoLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [24, 24] });
      }
    },

    recordOf(mineName) {
      const list = this.dataset[`${mineName}_${this.currentSensor}`] || [];
      return list.find(item => String(item.year) === String(this.currentYear)) || null;
    },

    featureStyle(feature) {
      const info = this.recordOf(feature.properties.mine);
      const color = info ? this.gradeColor(info.restorationGrade) : '#9aa4b2';
      return {
        color: '#ffffff',
        weight: 2,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: 0.62,
      };
    },

    updateMapStyle() {
      if (!this.geoLayer) return;
      this.geoLayer.setStyle(feature => this.featureStyle(feature));
      // tooltip 内容是绑定时的快照，年份/数据源切换后需要重新绑定
      this.geoLayer.eachLayer(layer => {
        const name = layer.feature.properties.mine;
        const info = this.recordOf(name);
        layer.setTooltipContent(
          `<b>${name}</b><br/>${this.currentYear} 年 · 得分 ${info ? info.totalScore : '—'}` +
          `<br/>等级 ${info ? info.restorationGrade : '无记录'}`
        );
      });
    },

    renderTrend() {
      if (!this.$refs.trendChart) return;
      if (!this.trendChart) this.trendChart = echarts.init(this.$refs.trendChart);

      const allYears = this.years;
      const series = allYears.map(year => {
        const scores = this.mines.map(mine => {
          const list = this.dataset[`${mine}_${this.currentSensor}`] || [];
          const hit = list.find(item => String(item.year) === String(year));
          return hit ? Number(hit.totalScore) : null;
        }).filter(v => v !== null);
        return scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
      });

      // 当前年份的标记点：该年没有数据时不画，避免 ECharts 拿到 null 坐标报错
      const currentIndex = allYears.indexOf(Number(this.currentYear));
      const currentValue = currentIndex >= 0 ? series[currentIndex] : null;
      const markData = (currentValue === null || currentValue === undefined)
        ? []
        : [{ coord: [currentIndex, currentValue], value: '' }];

      this.trendChart.setOption({
        grid: { left: 44, right: 18, top: 24, bottom: 28 },
        tooltip: { trigger: 'axis', valueFormatter: v => `${v} 分` },
        xAxis: {
          type: 'category',
          data: allYears.map(String),
          axisLine: { lineStyle: { color: '#dcdfe6' } },
          axisTick: { show: false },
          axisLabel: {
            color: '#7a8290',
            fontSize: 11,
            // 年份多时自动隐藏重叠标签并斜排，避免文字糊成一片
            interval: allYears.length > 8 ? 'auto' : 0,
            rotate: allYears.length > 8 ? 32 : 0,
            hideOverlap: true,
          },
        },
        yAxis: {
          type: 'value',
          min: 40,
          max: 100,
          splitLine: { lineStyle: { color: '#f0f2f5' } },
          axisLabel: { color: '#7a8290', fontSize: 11 },
        },
        series: [
          {
            type: 'line',
            data: series,
            // 只有离散年份观测值，用直线段表达，避免平滑曲线产生不存在的中间走势
            smooth: false,
            symbolSize: 8,
            lineStyle: { width: 2.5, color: '#378add' },
            itemStyle: { color: '#378add' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(55,138,221,0.28)' },
                { offset: 1, color: 'rgba(55,138,221,0.02)' },
              ]),
            },
            label: {
              show: true,
              position: 'top',
              fontSize: 11,
              color: '#2f3542',
              formatter: p => (p.value === null ? '' : p.value),
            },
            markPoint: {
              data: markData,
              symbol: 'circle',
              symbolSize: 12,
              itemStyle: { color: '#378add', borderColor: '#ffffff', borderWidth: 2 },
              label: { show: false },
            },
          },
        ],
      });
    },

    renderGradeChart() {
      if (!this.$refs.gradeChart) return;
      if (!this.gradeChart) this.gradeChart = echarts.init(this.$refs.gradeChart);

      this.gradeChart.setOption({
        grid: { left: 34, right: 16, top: 18, bottom: 26 },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => `${v} 条` },
        xAxis: {
          type: 'category',
          data: GRADES,
          axisLine: { lineStyle: { color: '#dcdfe6' } },
          axisTick: { show: false },
          axisLabel: { color: '#7a8290', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          splitLine: { lineStyle: { color: '#f0f2f5' } },
          axisLabel: { color: '#7a8290', fontSize: 11 },
        },
        series: [
          {
            type: 'bar',
            data: GRADES.map(grade => ({
              value: this.gradeCounts[grade] || 0,
              itemStyle: { color: GRADE_COLORS[grade], borderRadius: [3, 3, 0, 0] },
            })),
            barWidth: '52%',
            label: { show: true, position: 'top', fontSize: 11, color: '#2f3542' },
          },
        ],
      });
    },

    handleResize() {
      if (this.trendChart) this.trendChart.resize();
      if (this.gradeChart) this.gradeChart.resize();
      if (this.map) this.map.invalidateSize();
    },

    /**
     * 用 ResizeObserver 监听图表容器尺寸。
     * 拖拽调宽、窗口缩放、卡片高度变化都会触发，ECharts 按新尺寸重绘，
     * 因此左右栏拉宽后图表会自动变长，无需手动调用 resize。
     */
    observeContainers() {
      if (typeof ResizeObserver === 'undefined') return;
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._resizeObserver = new ResizeObserver(() => {
        if (this.trendChart) this.trendChart.resize();
        if (this.gradeChart) this.gradeChart.resize();
        this.scheduleMapResize();
      });
      [this.$refs.trendChart, this.$refs.gradeChart, this.$refs.mapBox].forEach(el => {
        if (el) this._resizeObserver.observe(el);
      });
    },

    /** 地图重算尺寸较重，用 rAF 合并同一帧内的多次调用 */
    scheduleMapResize() {
      if (this._mapRaf) return;
      this._mapRaf = requestAnimationFrame(() => {
        this._mapRaf = null;
        if (this.map) this.map.invalidateSize();
      });
    },

    startResize(side, event) {
      this.resizing = side;
      this._startX = event.clientX;
      this._startWidth = side === 'left' ? this.leftWidth : this.rightWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', this.onResizeMove);
      window.addEventListener('mouseup', this.onResizeEnd);
    },

    onResizeMove(event) {
      if (!this.resizing) return;
      const delta = event.clientX - this._startX;
      // 右栏在右侧，往右拖应当是变窄，因此取负
      const raw = this.resizing === 'left'
        ? this._startWidth + delta
        : this._startWidth - delta;
      const next = Math.min(COL_MAX, Math.max(COL_MIN, raw));
      if (this.resizing === 'left') {
        this.leftWidth = next;
      } else {
        this.rightWidth = next;
      }
    },

    onResizeEnd() {
      if (!this.resizing) return;
      this.resizing = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', this.onResizeMove);
      window.removeEventListener('mouseup', this.onResizeEnd);
      this.persistWidths();
    },

    resetWidth(side) {
      if (side === 'left') {
        this.leftWidth = COL_DEFAULT;
      } else {
        this.rightWidth = COL_DEFAULT;
      }
      this.persistWidths();
    },

    persistWidths() {
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify({
          left: this.leftWidth,
          right: this.rightWidth,
        }));
      } catch (error) {
        // 隐私模式下 localStorage 可能不可写，忽略即可
      }
    },
  },
};
</script>

<style scoped>
.dashboard {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 14px 18px 10px;
  background: #f4f6fa;
  color: #2f3542;
  overflow: hidden;
}

/* 顶栏 */
.db-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e3e7ee;
  flex-shrink: 0;
}

.db-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.db-brand h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.db-sub {
  font-size: 11px;
  color: #9aa4b2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.db-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.db-seg {
  display: inline-flex;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

/* 年份多时横向滚动，不挤压右侧按钮 */
.db-seg-years {
  max-width: 42vw;
  overflow-x: auto;
  scrollbar-width: thin;
}

.db-seg-years::-webkit-scrollbar {
  height: 4px;
}

.db-seg-years::-webkit-scrollbar-thumb {
  background: #d5dae3;
  border-radius: 2px;
}

.db-seg-btn {
  border: 0;
  background: transparent;
  padding: 6px 12px;
  font-size: 12px;
  color: #5a6b85;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  flex: none;
  white-space: nowrap;
}

.db-seg-btn + .db-seg-btn {
  border-left: 1px solid #eef1f5;
}

.db-seg-btn.active {
  background: #378add;
  color: #fff;
}

.db-seg-btn:hover:not(.active) {
  background: #f4f6fa;
}

.db-enter {
  border: 0;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 12.5px;
  color: #fff;
  background: #2f3542;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}

.db-enter:hover {
  background: #1a1e26;
}

/* 主体：flex 布局，左右栏固定宽（可拖拽），中栏吃掉剩余空间 */
.db-body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding-top: 12px;
}

.db-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

.db-col-left,
.db-col-right {
  flex: 0 0 auto;
}

.db-col-center {
  flex: 1 1 auto;
  min-width: 0;
}

/* 拖拽分隔条 */
.db-resizer {
  flex: 0 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  user-select: none;
}

.db-resizer span {
  width: 3px;
  height: 46px;
  border-radius: 2px;
  background: #dfe3ea;
  transition: background 0.15s, height 0.15s;
}

.db-resizer:hover span,
.db-resizer.is-active span {
  background: #378add;
  height: 86px;
}

.db-card {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.db-card-grow {
  flex: 1;
  min-height: 0;
}

.db-card-fill {
  flex: 1;
  min-height: 0;
}

.db-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 500;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.db-card-note {
  font-size: 10.5px;
  font-weight: 400;
  color: #9aa4b2;
  white-space: nowrap;
}

.db-card-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* 地图卡右上角的注记开关 */
.db-anno-btn {
  border: 1px solid #dfe3ea;
  background: #fff;
  border-radius: 4px;
  padding: 1px 7px;
  font-size: 10.5px;
  color: #378add;
  cursor: pointer;
  font-family: inherit;
  line-height: 17px;
  transition: all 0.15s;
}

.db-anno-btn:hover {
  background: #f4f8fe;
}

.db-anno-btn.is-off {
  color: #9aa4b2;
  border-color: #e6eaf0;
  background: #f7f8fa;
}

/* KPI */
.db-kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  flex-shrink: 0;
}

.db-kpi {
  background: #fff;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  padding: 9px 11px;
}

.db-kpi-label {
  font-size: 10.5px;
  color: #9aa4b2;
  margin-bottom: 3px;
}

.db-kpi-value {
  font-size: 19px;
  font-weight: 500;
  line-height: 1.2;
}

.db-kpi-unit {
  font-size: 11px;
  font-weight: 400;
  color: #9aa4b2;
  margin-left: 2px;
}

.db-kpi-hint {
  font-size: 10px;
  color: #b3bbc7;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 图表容器 */
.db-chart {
  flex: 1;
  min-height: 120px;
}

/* 地图 */
.db-map-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 6px;
  overflow: hidden;
}

.db-map {
  position: absolute;
  inset: 0;
}

.db-legend {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 500;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
}

.db-legend-title {
  font-size: 10.5px;
  color: #9aa4b2;
  margin-bottom: 5px;
}

.db-legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.7;
  color: #5a6b85;
}

.db-legend-row i {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex: none;
}

/* 排名 */
.db-rank {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.db-rank-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.db-rank-name {
  color: #2f3542;
}

.db-rank-score {
  font-weight: 500;
}

.db-grade {
  font-style: normal;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
}

.db-grade.is-good {
  background: #e8f5e9;
  color: #2e7d32;
}

.db-grade.is-mid {
  background: #fff8e1;
  color: #a06a00;
}

.db-grade.is-bad {
  background: #fdecea;
  color: #b3261e;
}

.db-rank-bar {
  height: 7px;
  background: #f0f2f5;
  border-radius: 4px;
  overflow: hidden;
}

.db-rank-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.35s ease;
}

/* 指标均值列表 */
.db-metrics {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-height: 0;
}

.db-metric-row {
  padding: 10px 0;
  border-bottom: 1px dashed #eff2f6;
}

.db-metric-row:last-of-type {
  border-bottom: 0;
}

.db-metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 7px;
}

.db-metric-bar {
  height: 4px;
  border-radius: 3px;
  background: #f0f2f5;
  overflow: hidden;
}

.db-metric-fill {
  height: 100%;
  border-radius: 3px;
  background: #378add;
  transition: width 0.35s ease;
}

.db-metrics-note {
  padding-bottom: 2px;
  font-size: 10.5px;
  color: #b3bbc7;
}

.db-metric-name {
  color: #5a6b85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.db-metric-value {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.db-metric-value em {
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  color: #9aa4b2;
  margin-left: 2px;
}

/* 底栏 */
.db-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  font-size: 10.5px;
  color: #9aa4b2;
  border-top: 1px solid #e3e7ee;
}
</style>

<style>
/* tooltip 由 Leaflet 渲染在组件 DOM 之外，scoped 样式覆盖不到，需全局定义 */
.db-map-label {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  box-shadow: none;
  color: #2f3542;
  font-size: 11px;
  line-height: 1.5;
  padding: 4px 7px;
  text-align: center;
}

.db-map-label::before {
  display: none;
}
</style>
