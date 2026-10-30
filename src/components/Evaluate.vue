<template>
  <div class="evaluate-panel">
    <!-- 选择框和按钮布局 -->
    <div class="toolbar-row">
      <!-- 矿区选择框 -->
      <el-select v-model="selectedMine" placeholder="请选择矿区" class="toolbar-select toolbar-select-mine" @change="handleMineChange">
        <el-option
          v-for="item in mineOptions"
          :key="item.id"
          :label="item.name"
          :value="item.name"
        ></el-option>
      </el-select>

      <!-- 数据源选择框：位于矿区选择框右侧 -->
      <el-select v-model="selectedSensor" placeholder="数据源" class="toolbar-select">
        <el-option
          v-for="item in sensorOptions"
          :key="item.id"
          :label="item.label"
          :value="item.id"
        ></el-option>
      </el-select>

      <!-- 图形分析按钮 -->
      <el-button type="primary" @click="showChartAnalysis">图形分析</el-button>

      <!-- 右侧空白区域 -->
      <div style="flex-grow: 1;"></div>

      <!-- 添加按钮 -->
      <el-button type="primary" @click="openAddDialog">添加</el-button>
    </div>

    <!-- 表格 -->
    <el-table v-if="showTable" :data="currentTableData" class="result-table" height="calc(100vh - 210px)">
      <el-table-column prop="FVC" label="植被覆盖度FVC(%)" min-width="100" align="center"></el-table-column>
      <el-table-column prop="VRI" label="植被恢复指数VRI" min-width="100" align="center"></el-table-column>
      <el-table-column prop="NDMI" label="土壤湿度指数NDMI" min-width="120" align="center"></el-table-column>
      <el-table-column prop="NDSI" label="裸土指数NDSI" min-width="100" align="center"></el-table-column>
      <el-table-column prop="RSEI" label="遥感生态指数RSEI" min-width="120" align="center"></el-table-column>
      <el-table-column prop="environmentalCoordination" label="环境协调性" min-width="100" align="center"></el-table-column>
      <el-table-column prop="Soilpollution" label="土壤污染" min-width="80" align="center"></el-table-column>
      <el-table-column prop="year" label="年份" min-width="60" align="center"></el-table-column>
      <el-table-column prop="sensor" label="数据源" min-width="90" align="center">
        <template slot-scope="scope">
          {{ scope.row.sensor === 'sentinel2' ? 'Sentinel-2' : (scope.row.sensor === 'landsat89' ? 'Landsat 8/9' : '—') }}
        </template>
      </el-table-column>
      <el-table-column prop="restorationGrade" label="修复等级" min-width="80" align="center"></el-table-column>
      <el-table-column prop="totalScore" label="综合得分" min-width="80" align="center"></el-table-column>
      <el-table-column label="操作" min-width="80" align="center">
        <template slot-scope="scope">
          <el-button size="mini" type="danger" @click="deleteRow(scope.$index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 图形分析：内嵌在结果表下方，随表格内容自然下移，不再浮层遮挡右侧操作列 -->
    <div v-if="chartDialogVisible" v-loading="chartLoading" class="chart-panel">
      <div class="chart-panel-head">
        <span class="chart-panel-title">图形分析</span>
        <el-button
          type="text"
          icon="el-icon-close"
          class="chart-panel-close"
          @click="chartDialogVisible = false"
        >关闭</el-button>
      </div>
      <div class="chart-container">
        <div v-if="!chartLoading && !hasChartData" class="chart-empty">
          当前矿区与数据源下还没有评价结果，请先点击「添加」录入数据。
        </div>
        <div class="chart-main" :class="{ 'chart-hidden': !hasChartData }">
          <div ref="trendChart" class="chart-canvas"></div>
        </div>
        <div class="chart-side" :class="{ 'chart-hidden': !hasChartData }">
          <div ref="gradeChart" class="chart-canvas chart-canvas-sm"></div>
        </div>
      </div>
    </div>

    <!-- 添加信息对话框 -->
    <el-dialog
      :visible.sync="dialogVisible"
      title="添加评价信息"
      :modal="false"
      width="680px"
      top="8vh"
      append-to-body
      custom-class="evaluate-dialog"
      @close="cacheFormDraft"
    >
      <el-form ref="form" :model="form" :rules="rules" label-width="0">
      <div class="dialog-scroll-body">

        <!-- 五个指标用 CSS Grid 三列布局：标签为独立列，列宽固定保证纵向严格对齐 -->
        <div class="metric-grid">
          <div class="grid-row grid-head">
            <span class="grid-col-label head">评价指标</span>
            <span class="grid-col head">指标值</span>
            <span class="grid-col head">权重</span>
          </div>
          <div
            v-for="metric in metricFields"
            :key="metric.key"
            class="grid-row"
          >
            <label class="grid-col-label">{{ metric.label }}</label>
            <el-form-item class="grid-col-item" :prop="metric.key" label-width="0">
              <el-input
                v-model.number="form[metric.key]"
                type="number"
                step="0.01"
                :placeholder="metric.placeholder"
              ></el-input>
            </el-form-item>
            <el-form-item class="grid-col-item" :prop="metric.key + 'Weight'" label-width="0">
              <el-input
                v-model.number="form[metric.key + 'Weight']"
                type="number"
                step="0.01"
                placeholder="请输入权重"
              ></el-input>
            </el-form-item>
          </div>
        </div>

        <!-- 其余三项同样用 Grid 布局，列宽与上方指标表保持一致 -->
        <div class="metric-grid">
          <div class="grid-row">
            <label class="grid-col-label">与周边环境协调性</label>
            <el-form-item class="grid-col-item" prop="environmentalCoordination" label-width="0">
              <el-select v-model="form.environmentalCoordination" placeholder="请选择">
                <el-option label="极好" value="极好"></el-option>
                <el-option label="好" value="好"></el-option>
                <el-option label="适中" value="适中"></el-option>
                <el-option label="差" value="差"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="grid-col-item" label-width="0"></el-form-item>
          </div>

          <div class="grid-row">
            <label class="grid-col-label">土壤污染</label>
            <el-form-item class="grid-col-item" prop="Soilpollution" label-width="0">
              <el-select v-model="form.Soilpollution" placeholder="请选择">
                <el-option label="严重" value="严重"></el-option>
                <el-option label="适中" value="适中"></el-option>
                <el-option label="轻微" value="轻微"></el-option>
                <el-option label="无污染" value="无污染"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="grid-col-item" label-width="0"></el-form-item>
          </div>

          <div class="grid-row">
            <label class="grid-col-label">评价年份</label>
            <el-form-item class="grid-col-item" prop="year" label-width="0">
              <el-select
                v-model="form.year"
                placeholder="请选择评价年份"
                @change="loadEvaluationMetrics"
              >
                <el-option v-for="year in yearOptions" :key="year" :label="String(year)" :value="String(year)"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="grid-col-item" label-width="0"></el-form-item>
          </div>
        </div>

        <div class="action-row">
          <el-button type="primary" :loading="loadingMetrics" @click="loadEvaluationMetrics">按年份自动回填指标</el-button>
          <el-button type="primary" @click="validateAndCalculate">计算综合评价</el-button>
        </div>
        </div>
      </el-form>

      <div slot="footer" class="dialog-footer">
        <span class="footer-grade">修复等级结果：{{ form.restorationGrade || '—' }}</span>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapMutations } from 'vuex';
import DataService from '../services/DataService.js';
import config from '../assets/config.js';
import { publishWMSLayer } from '../assets/utils.js';
// echarts 5 是纯 ESM 包，index.js 里只有 export * 而没有 export default，
// 用默认导入拿到的是 undefined（webpack 会警告 "export 'default' was not found"），
// 会导致下方 drawCharts() 在 `if (!echarts) return` 处静默返回、图表画不出来。
import * as echartsLib from 'echarts';

export default {
  data() {
    return {
      showTable: true,
      dialogVisible: false,
      chartDialogVisible: false,
      chartLoading: false,
      chartRows: [],
      trendChart: null,
      gradeChart: null,
      chartResizeHandler: null,
      form: {
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
      },
      metricMessages: {},
      // 五个指标的表格化配置：统一 label/placeholder，避免长标签被截断
      metricFields: [
        { key: 'FVC', label: '植被覆盖度 FVC (%)', placeholder: '请输入FVC' },
        { key: 'VRI', label: '植被恢复指数 VRI', placeholder: '请输入VRI' },
        { key: 'NDMI', label: '土壤湿度指数 NDMI', placeholder: '请输入NDMI' },
        { key: 'NDSI', label: '裸土指数 NDSI', placeholder: '请输入NDSI' },
        { key: 'RSEI', label: '遥感生态指数 RSEI', placeholder: '请输入RSEI' },
      ],
      yearOptions: config.availableYears().map(item => String(item)),
      mineOptions: config.mines,
      sensorOptions: config.sensors,
      mineAreaPath: config.mineAreaPath || '',
      mineNameField: config.mineNameField || 'name',
      loadingMetrics: false,
      // 表单草稿：对话框取消关闭时保留已填内容，下次打开自动恢复。
      formDraft: null,
      metricConfig: {
        FVC: { label: 'FVC', resultKey: 'fvc' },
        VRI: { label: 'VRI', resultKey: 'vri' },
        NDMI: { label: 'NDMI', resultKey: 'ndmi' },
        NDSI: { label: 'NDSI', resultKey: 'ndsi' },
        // RSEI 依赖地表温度 LST，Sentinel-2 无热红外波段，只能用 Landsat。
        RSEI: { label: 'RSEI', resultKey: 'rsei', fixedSensor: 'landsat89' },
      },
      rules: {
        FVC: [{ required: true, message: '请输入FVC', trigger: 'blur' }],
        FVCWeight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
        VRI: [{ required: true, message: '请输入VRI', trigger: 'blur' }],
        VRIWeight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
        NDMI: [{ required: true, message: '请输入NDMI', trigger: 'blur' }],
        NDMIWeight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
        NDSI: [{ required: true, message: '请输入NDSI', trigger: 'blur' }],
        NDSIWeight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
        RSEI: [{ required: true, message: '请输入RSEI', trigger: 'blur' }],
        RSEIWeight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
        environmentalCoordination: [{ required: true, message: '请选择环境协调性', trigger: 'change' }],
        Soilpollution: [{ required: true, message: '请选择土壤污染', trigger: 'change' }],
        year: [{ required: true, message: '请选择年份', trigger: 'change' }]
      }
    };
  },
  computed: {
    ...mapGetters(['getSelectedMine', 'getSelectedSensor', 'getTableData']),
    selectedMine: {
      get() {
        return this.getSelectedMine;
      },
      set(value) {
        this.setSelectedMine(value);
      }
    },
    // 数据源与 store 双向绑定，切换后结果表自动跟着切换
    selectedSensor: {
      get() {
        return this.getSelectedSensor;
      },
      set(value) {
        this.setSelectedSensor(value);
      }
    },
    currentTableData() {
      return this.getTableData;
    },
    // 是否存在可绘制的年份数据，直接由结果表推导，避免依赖异步更新的 chartRows
    hasChartData() {
      const rows = this.currentTableData || [];
      return rows.some(row => String((row && row.year) || '').trim() !== '');
    }
  },
  watch: {
    // 面板展开后触发首次绘制（替代原 el-dialog 的 @opened）
    chartDialogVisible(visible) {
      if (visible) {
        this.renderChartPanel();
      }
    },
    // 面板展开状态下切换矿区或数据源，图表需按新数据重绘
    selectedMine() {
      this.refreshChartIfOpen();
    },
    selectedSensor() {
      this.refreshChartIfOpen();
    },
    currentTableData() {
      this.refreshChartIfOpen();
    },
  },
  mounted() {
  },
  beforeDestroy() {
    this.disposeCharts();
    if (this.chartResizeHandler) {
      window.removeEventListener('resize', this.chartResizeHandler);
      this.chartResizeHandler = null;
    }
  },
  methods: {
    ...mapActions(['setSelectedMine', 'setSelectedSensor']),
    ...mapMutations([
      'deleteTableData',
      'resetFormData',
      'addTableData'
    ]),
    handleMineChange(mine) {
      // 更新当前选中的矿区
      this.$store.commit('setSelectedMine', mine);
      console.log('已切换到矿区:', mine);
      console.log('当前矿区数据:', this.currentTableData);
    },
    openAddDialog() {
      // 打开对话框时恢复上次填写的内容，取消关闭不会丢失数据。
      this.dialogVisible = true;
      if (this.formDraft && Object.keys(this.formDraft).length) {
        this.form = { ...this.form, ...this.formDraft };
      }
      this.$nextTick(() => {
        if (this.$refs.form) this.$refs.form.clearValidate();
      });
    },
    // 关闭对话框时把当前内容存为草稿，下次打开自动恢复。
    cacheFormDraft() {
      this.formDraft = { ...this.form };
    },
    showChartAnalysis() {
      // 图形分析现在是表格下方的内嵌面板，展开后由 chartDialogVisible 的
      // watcher 触发绘制（不再依赖 el-dialog 的 @opened 事件）。
      this.chartDialogVisible = !this.chartDialogVisible;
      if (this.chartDialogVisible) {
        this.chartLoading = true;
      } else {
        // 收起时销毁图表实例，避免残留实例持有已移除的 DOM
        this.disposeCharts();
      }
    },
    renderChartPanel() {
      this.chartLoading = true;
      // 面板刚插入 DOM 时容器宽高可能尚未就绪，连续两帧后再绘制。
      const draw = () => {
        this.$nextTick(() => {
          this.renderCharts();
        });
      };
      this.$nextTick(draw);
      setTimeout(draw, 120);
    },
    // 从当前「矿区 + 数据源」的结果表构造图表数据，年份数量可任意增减
    buildChartModel() {
      const rows = this.currentTableData || [];
      if (!rows.length) return { years: [], series: [], gradeLabels: [] };

      // 年份去重后按数值升序排列，保证 x 轴从早到晚
      const yearMap = new Map();
      rows.forEach(row => {
        const year = String(row.year || '').trim();
        if (!year || yearMap.has(year)) return;
        yearMap.set(year, row);
      });
      const years = Array.from(yearMap.keys()).sort((a, b) => Number(a) - Number(b));
      const records = years.map(year => yearMap.get(year));

      const metrics = [
        // FVC 在结果表里按百分数录入（表头即「植被覆盖度FVC(%)」，28 表示 28%），
        // 而 VRI/NDMI/NDSI/RSEI 都是 -1~1 的指数。直接画在一起会相差几十倍，
        // 折线全被压成贴着 0 的直线，所以这里把 FVC 折算成小数（28% → 0.28）统一量纲。
        { key: 'FVC', name: '植被覆盖度FVC', toFraction: true },
        { key: 'VRI', name: '植被恢复指数VRI' },
        { key: 'NDMI', name: '土壤湿度指数NDMI' },
        { key: 'NDSI', name: '裸土指数NDSI' },
        { key: 'RSEI', name: '遥感生态指数RSEI' },
      ];
      const series = metrics.map(metric => ({
        name: metric.name,
        data: records.map(row => {
          const value = Number(row[metric.key]);
          if (!Number.isFinite(value)) return null;
          // 百分数除以 100；若该条记录的 FVC 已经录成小数（≤1）则原样使用，
          // 避免把 0.28 这种本来就正确的值再缩小 100 倍。
          if (metric.toFraction && Math.abs(value) > 1) {
            // 顺带收敛到 4 位小数，避免 28.33333/100 这类浮点尾数带进图表
            return Number((value / 100).toFixed(4));
          }
          return value;
        }),
      }));

      // 修复等级按年份逐条取值，与趋势图 x 轴一一对应
      const gradeLabels = records.map(row => String(row.restorationGrade || '').trim() || '暂无');

      return { years, series, gradeLabels };
    },
    renderCharts() {
      // 无论后续是否出错都要关闭 loading，避免弹窗一直转圈
      try {
        this.drawCharts();
      } catch (error) {
        console.error('图形分析渲染失败:', error);
        this.$message.error('图形渲染失败，请检查结果表数据。');
      } finally {
        this.chartLoading = false;
      }
    },
    drawCharts() {
      const echarts = echartsLib;
      if (!echarts) {
        // 以前这里直接 return，图表库加载异常时完全没有反馈，
        // 界面上只会看到空弹窗，排查起来很困难。
        console.error('ECharts 未正确加载：echartsLib 为空值');
        this.$message.error('图表库加载失败，无法生成图形分析。');
        return;
      }
      const model = this.buildChartModel();
      this.chartRows = model.years;

      this.disposeCharts();
      if (!model.years.length) return;

      // 容器若还没拿到宽高（例如弹窗刚打开动画未结束），
      // echarts.init 会得到 0x0 的画布而无法绘制，这里直接跳过，
      // 待尺寸就绪后由 resize 逻辑补画。
      const trendEl = this.$refs.trendChart;
      const gradeEl = this.$refs.gradeChart;
      if (!trendEl || !gradeEl || !trendEl.clientWidth || !gradeEl.clientWidth) return;

      const mineLabel = String(this.selectedMine || '');

      // 左：五项指标年度折线
      this.trendChart = echarts.init(trendEl);
      this.trendChart.setOption({
        title: {
          text: `${mineLabel} 指标年度变化`,
          left: 'center',
          top: 6,
          textStyle: { fontSize: 16, fontWeight: 'normal', color: '#303133' },
        },
        tooltip: {
          trigger: 'axis',
          // FVC 由百分数除 100 得来（28.33333 → 0.2833333），默认会把浮点尾数全部显示出来，
          // 这里统一保留 4 位小数并去掉末尾多余的 0（0.2800 → 0.28）。
          // 想改精度只需调整下面的 toFixed(4)。
          formatter: params => {
            const format = value => {
              if (!Number.isFinite(value)) return '—';
              return String(Number(Number(value).toFixed(4)));
            };
            const head = params && params.length ? `${params[0].axisValue} 年` : '';
            const rows = (params || []).map(
              item => `${item.marker}${item.seriesName}：${format(item.value)}`
            );
            return [head].concat(rows).join('<br/>');
          },
        },
        legend: {
          data: model.series.map(item => item.name),
          // 五个指标名称较长，放顶部会与居中标题重叠，改为底部单行横排
          left: 'center',
          bottom: 4,
          itemWidth: 18,
          itemHeight: 9,
          itemGap: 12,
          textStyle: { fontSize: 12 },
        },
        grid: { left: 82, right: 32, top: 48, bottom: 100 },
        xAxis: {
          type: 'category',
          data: model.years,
          name: '年份',
          nameLocation: 'middle',
          nameGap: 40,
          nameTextStyle: { fontSize: 15 },
          axisLabel: { fontSize: 13 },
          axisTick: { alignWithLabel: true },
        },
        yAxis: {
          type: 'value',
          name: '指标值',
          // 五项指标统一到同一量纲：FVC 已折算成 0~1 小数，
          // 而 NDMI/NDSI 等指数本身就在 -1~1，所以纵轴固定为 -1~1。
          min: -1,
          max: 1,
          interval: 0.5,
          nameGap: 24,
          nameTextStyle: { fontSize: 15 },
          axisLabel: { fontSize: 13 },
        },
        series: model.series.map(item => ({
          name: item.name,
          type: 'line',
          data: item.data,
          connectNulls: true,
          symbolSize: 9,
          lineStyle: { width: 2.5 },
        })),
      });

      // 修复等级四档对应的分值：分值越高柱越高，优秀在最上方
      const gradeScoreMap = { '较差': 1, '中等': 2, '良好': 3, '优秀': 4 };
      const scoreOfGrade = label => gradeScoreMap[String(label || '').trim()] || 0;

      // 右：修复等级柱状，年份与左侧一致
      this.gradeChart = echarts.init(gradeEl);
      this.gradeChart.setOption({
        title: {
          // top 调小让标题上移到图表顶端，fontSize 放大
          text: `${mineLabel} 生态评估年度变化`,
          left: 'center',
          top: 6,
          textStyle: { fontSize: 17, fontWeight: 'normal', color: '#303133' },
        },
        tooltip: {
          trigger: 'axis',
          formatter: params => {
            const item = params && params[0];
            if (!item) return '';
            const raw = model.gradeLabels[item.dataIndex] || '暂无';
            return `${item.axisValue} 年<br/>修复等级：${raw}`;
          },
        },
        // top 由 46 加大到 100，把绘图区整体下压，
        // 使纵坐标名称「修复等级」与上方标题拉开距离
        grid: { left: 88, right: 28, top: 100, bottom: 64 },
        xAxis: {
          type: 'category',
          data: model.years,
          name: '年份',
          nameLocation: 'middle',
          nameGap: 40,
          nameTextStyle: { fontSize: 15 },
          axisLabel: { fontSize: 13 },
          axisTick: { alignWithLabel: true },
        },
        yAxis: {
          // 用数值轴而不是类目轴：高度直接表示等级高低，优秀最高、位于最上方。
          // 原来的类目轴是 ['优秀','良好','适中','较差']，不但方向相反，
          // 而且「适中」与判定逻辑实际产出的「中等」对不上，中等的年份画不出柱。
          type: 'value',
          min: 0,
          max: 4.5,
          interval: 1,
          name: '修复等级',
          nameGap: 28,
          // 右对齐，使「修复等级」的右边缘与「中等」「优秀」等刻度文字对齐。
          // 默认是居中对齐，轴名右边缘会伸到刻度文字右侧约 38px，看起来是错开的。
          nameTextStyle: { fontSize: 15, color: '#606266', align: 'right' },
          axisLabel: {
            fontSize: 13,
            formatter: value => ({ 1: '较差', 2: '中等', 3: '良好', 4: '优秀' }[value] || ''),
          },
          // 等级轴上这些横向虚线没有参考价值，去掉
          splitLine: { show: false },
        },
        series: [
          {
            type: 'bar',
            barWidth: '46%',
            itemStyle: { color: '#f0a83c' },
            // 柱顶直接标出等级文字，避免只靠高度猜
            label: {
              show: true,
              position: 'top',
              fontSize: 13,
              color: '#b06d0a',
              formatter: params => model.gradeLabels[params.dataIndex] || '',
            },
            data: model.gradeLabels.map(label => scoreOfGrade(label)),
          },
        ],
      });

      if (!this.chartResizeHandler) {
        this.chartResizeHandler = () => {
          if (this.trendChart) this.trendChart.resize();
          if (this.gradeChart) this.gradeChart.resize();
        };
        window.addEventListener('resize', this.chartResizeHandler);
      }

      // 兜底：若本次因容器尺寸不足未初始化，延迟再试一次
      if (!this.trendChart || !this.gradeChart) {
        setTimeout(() => {
          if (this.chartDialogVisible && (!this.trendChart || !this.gradeChart)) {
            this.renderCharts();
          }
        }, 300);
      }
    },
    disposeCharts() {
      if (this.trendChart) {
        this.trendChart.dispose();
        this.trendChart = null;
      }
      if (this.gradeChart) {
        this.gradeChart.dispose();
        this.gradeChart = null;
      }
    },
    // 弹窗已打开时，数据变化后延迟重绘（等待 DOM 更新完成）
    refreshChartIfOpen() {
      if (!this.chartDialogVisible) return;
      this.$nextTick(() => {
        this.renderCharts();
      });
    },
    resetForm() {
      this.form = {
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
    },
    mapToScore(value, ranges) {
      for (const range of ranges) {
        if (value >= range.inMin && value <= range.inMax) {
          return this.mapRangeToScore(value, range.inMin, range.inMax, range.outMin, range.outMax);
        }
      }
      return 0; // 默认值
    },
    mapRangeToScore(value, inMin, inMax, outMin, outMax) {
      let score = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
      return parseFloat(score.toFixed(2)); // 返回数字类型
    },
    mapFVCToScore(index) {
      const ranges = [
        { inMin: 0, inMax: 10, outMin: 0, outMax: 20 },
        { inMin: 10, inMax: 30, outMin: 21, outMax: 40 },
        { inMin: 30, inMax: 50, outMin: 41, outMax: 60 },
        { inMin: 50, inMax: 70, outMin: 61, outMax: 80 },
        { inMin: 70, inMax: 100, outMin: 81, outMax: 100 }
      ];
      return this.mapToScore(index, ranges);
    },
    mapVRIToScore(index) {
      const ranges = [
        { inMin: -1, inMax: -0.3, outMin: 0, outMax: 40 },
        { inMin: -0.3, inMax: 0.3, outMin: 41, outMax: 60 },
        { inMin: 0.3, inMax: 0.7, outMin: 61, outMax: 80 },
        { inMin: 0.7, inMax: 1, outMin: 80, outMax: 100 }
      ];
      return this.mapToScore(index, ranges);
    },
    mapNDMIToScore(index) {
      const ranges = [
        { inMin: -1, inMax: -0.3, outMin: 0, outMax: 40 },
        { inMin: -0.3, inMax: 0.3, outMin: 41, outMax: 60 },
        { inMin: 0.3, inMax: 0.7, outMin: 61, outMax: 80 },
        { inMin: 0.7, inMax: 1, outMin: 80, outMax: 100 }
      ];
      return this.mapToScore(index, ranges);
    },
    mapNDSIToScore(index) {
      // NDSI专用评分方法，值越低分数越高
      if (index <= -0.5) {
        return 100;  // NDSI <= -0.5 得100分
      } else if (index <= 0) {
        return 80 - ((index + 0.5) / 0.5) * 20;  // NDSI -0.5~0 得80-100分
      } else if (index <= 0.5) {
        return 60 - (index / 0.5) * 20;  // NDSI 0~0.5 得40-60分
      } else {
        return 40;  // NDSI > 0.5 得40分
      }
    },
    mapRSEIToScore(index) {
      const ranges = [
        { inMin: 0.8, inMax: 1, outMin: 90, outMax: 100 },
        { inMin: 0.6, inMax: 0.8, outMin: 70, outMax: 90 },
        { inMin: 0.3, inMax: 0.6, outMin: 61, outMax: 70 },
        { inMin: 0, inMax: 0.3, outMin: 0, outMax: 60 }
      ];
      return this.mapToScore(index, ranges);
    },
    calculateRestorationGrade() {
      // 检查所有必要参数是否都已输入
      const requiredFields = ['NDMI', 'NDMIWeight', 'NDSI', 'NDSIWeight', 'FVC', 'FVCWeight', 'VRI', 'VRIWeight', 'RSEI', 'RSEIWeight'];
      const allFieldsEntered = requiredFields.every(field => 
        this.form[field] !== null && this.form[field] !== undefined && this.form[field] !== ''
      );
      
      // 如果不是所有字段都已输入，则不计算等级
      if (!allFieldsEntered) {
        this.form.restorationGrade = "";
        return;
      }
      
      const score = this.mapFVCToScore(this.form.FVC) * this.form.FVCWeight
                  + this.mapVRIToScore(this.form.VRI) * this.form.VRIWeight
                  + this.mapNDMIToScore(this.form.NDMI) * this.form.NDMIWeight
                  + this.mapNDSIToScore(this.form.NDSI) * this.form.NDSIWeight
                  + this.mapRSEIToScore(this.form.RSEI) * this.form.RSEIWeight;

      this.form.totalScore = Number(score.toFixed(2));
      if (score >= 80) {
        this.form.restorationGrade = "优秀";
      } else if (score >= 70) {
        this.form.restorationGrade = "良好";
      } else if (score >= 60) {
        this.form.restorationGrade = "中等";
      } else {
        this.form.restorationGrade = "较差";
      }
    },
    async calculateMetricAndRecord(metric) {
      const item = this.metricConfig[metric];
      const year = Number(this.form.year);
      if (!item || !Number.isInteger(year) || year < 1900 || year > 2100) return false;

      // VRI 基准期固定为可用年份中最早的一年，与 VRI 计算面板保持一致。
      const baselineYear = metric === 'VRI'
        ? (config.availableYears()
            .map(Number)
            .filter(value => Number.isFinite(value) && value < year)
            .sort((a, b) => a - b)[0] || null)
        : null;
      if (metric === 'VRI' && baselineYear === null) {
        this.$set(this.metricMessages, metric, `${item.label} ${year} 年没有更早的可用基准年份`);
        return false;
      }
      let response;
      try {
        // RSEI 固定用 Landsat（需热红外波段），其余指标跟随所选数据源。
        const inputSensor = item.fixedSensor || this.selectedSensor;
        const rasterPath = inputSensor === 'sentinel2'
          ? config.sentinelRaster(year)
          : config.landsatRaster(year);
        const earlyPath = inputSensor === 'sentinel2'
          ? config.sentinelVriRaster(baselineYear)
          : config.landsatVriRaster(baselineYear);
        const latePath = inputSensor === 'sentinel2'
          ? config.sentinelVriRaster(year)
          : config.landsatVriRaster(year);

        const mineId = String(this.selectedMine || '').replace('矿区', 'mine');
        if (metric === 'FVC') {
          response = await DataService.process_fvc(rasterPath, inputSensor, year, this.mineAreaPath, this.mineNameField, mineId);
        } else if (metric === 'VRI') {
          response = await DataService.process_vri(earlyPath, latePath, inputSensor, year, baselineYear, this.mineAreaPath, this.mineNameField, mineId);
        } else if (metric === 'NDMI') {
          response = await DataService.process_ndmi(rasterPath, inputSensor, year, this.mineAreaPath, this.mineNameField, mineId);
        } else if (metric === 'NDSI') {
          response = await DataService.process_ndsi(rasterPath, inputSensor, year, this.mineAreaPath, this.mineNameField, mineId);
        } else if (metric === 'RSEI') {
          response = await DataService.process_rsei(config.landsatVriRaster(year), year, this.mineAreaPath, this.mineNameField, mineId);
        } else {
          response = await DataService.getMineStats(item.resultKey, {
          sensor: inputSensor,
          year,
          baseline_year: baselineYear || undefined,
          mine_id: mineId,
          mine_area_path: this.mineAreaPath || undefined,
          name_field: this.mineNameField || undefined
        });
        }

        const computed = response.data && response.data.result;
        if (computed && computed.mine_stats && computed.mine_stats.stats && computed.mine_stats.stats[mineId]) {
          const mineStats = computed.mine_stats.stats[mineId];
          if (mineStats.available && Number.isFinite(Number(mineStats.mean))) {
            this.$set(this.form, metric, Number(Number(mineStats.mean).toFixed(4)));
            this.$set(this.form.metricMeans, metric, Number(mineStats.mean));
            this.$set(this.form.metricLayers, metric, computed.publish || {});
            this.$set(this.metricMessages, metric, `${item.label} ${year} 年已计算、统计并记录`);
            return true;
          }
        }

        response = await DataService.getMineStats(item.resultKey, {
          sensor: inputSensor,
          year,
          baseline_year: baselineYear || undefined,
          mine_id: mineId,
          mine_area_path: this.mineAreaPath || undefined,
          name_field: this.mineNameField || undefined
        });
        const payload = response.data || {};
        const stats = payload.mine_stats && payload.mine_stats.stats;
        const mineStats = stats && stats[mineId];
        if (!mineStats || !mineStats.available || !Number.isFinite(Number(mineStats.mean))) {
          this.$set(this.metricMessages, metric, '暂无该年度矿区统计值（请先计算该指标并配置矿区面数据）');
          return false;
        }

        const value = Number(mineStats.mean);
        this.$set(this.form, metric, Number(value.toFixed(4)));
        this.$set(this.form.metricMeans, metric, value);
        this.$set(this.form.metricLayers, metric, payload.result && payload.result.publish);
        this.$set(this.metricMessages, metric, `${item.label} ${year} 年已自动回填`);
        return true;
      } catch (error) {
        const detail = error.response && error.response.data && error.response.data.error;
        this.$set(this.metricMessages, metric, detail || '暂无该年度结果，请先完成指标计算');
        return false;
      }
    },
    async recordAllMetrics() {
      const metrics = ['FVC', 'VRI', 'NDMI', 'NDSI', 'RSEI'];
      for (const metric of metrics) await this.calculateMetricAndRecord(metric);
    },
    async loadEvaluationMetrics() {
      if (!this.form.year || !this.selectedMine) return;
      this.loadingMetrics = true;
      try {
        await this.recordAllMetrics();
        this.calculateRestorationGrade();
      } finally {
        this.loadingMetrics = false;
      }
    },
    hasPublishedLayer(metric) {
      const layer = this.form.metricLayers[metric];
      return !!(layer && layer.layer_name);
    },
    publishMetricLayer(metric) {
      const item = this.metricConfig[metric];
      const layer = this.form.metricLayers[metric];
      const publish = layer || {};
      if (!publish.layer_name) {
        this.$message.error(`${item.label} 缺少后端返回的已发布图层名称，无法加载专题图。`);
        return;
      }
      const added = publishWMSLayer(this.$store.state.map, publish.wms_url || config.geoServerWMS, publish.layer_name);
      if (added) this.$message.success(`${item.label} 专题图层已加载`);
    },
    handleSubmit() {
      // 检查是否已经计算了修复等级
      if (!this.form.restorationGrade) {
        this.$message.warning('请先计算修复等级');
        return;
      }
      
      this.$refs.form.validate(valid => {
        if (valid) {
          // 更新 store 中的表单数据
          this.$store.commit('updateFormData', this.form);
          
          // 计算修复等级
          this.calculateLocalRestorationGrade();
          this.recordAllMetrics();
          
          // 将数据添加到表格并重置表单
          this.$store.commit('addTableData');
          this.$store.commit('resetFormData');
          this.formDraft = null;
          
          // 关闭对话框
          this.dialogVisible = false;
          
          // 重置本地表单
          this.resetForm();
        }
      });
    },
    // 使用本地方法计算修复等级，然后更新到store
    calculateLocalRestorationGrade() {
      // 先使用本地方法计算
      this.calculateRestorationGrade();
      
      // 然后更新到store
      this.$store.commit('updateFormData', {
        restorationGrade: this.form.restorationGrade
      });
    },
    deleteRow(index) {
      // 删除对应矿区的表格数据
      this.$store.commit('deleteTableData', index);
    },
    validateAndCalculate() {
      this.$refs.form.validate(valid => {
        if (valid) {
          this.calculateRestorationGrade();
        } else {
          this.$message.error('请填写完整的信息');
        }
      });
    }
  }
};
</script>

<style scoped>
.input-style {
  width: 130px;
  margin-left: 10px;
  margin-right: 10px;
}

/* ===== 面板整体布局 ===== */
/* 根容器铺满父级宽度，表格才能横向撑满可用空间 */
.evaluate-panel {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  padding: 10px 20px 16px;
  overflow: hidden;
}

.toolbar-row {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.toolbar-row .el-button {
  margin-left: 0;
  margin-right: 16px;
}

.toolbar-select {
  width: 140px;
  margin-right: 10px;
}

.toolbar-select-mine {
  width: 120px;
}

.result-table {
  flex: 1;
  width: 100%;
  margin-top: 12px;
}

/* 表格内容居中 */
.el-table td, .el-table th {
  text-align: center !important;
}

/* 图形分析内嵌面板：位于结果表下方，随表格高度自然下移，不再浮层遮挡右侧操作列 */
.chart-panel {
  margin: 16px 20px 24px;
  padding: 12px 16px 16px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.chart-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.chart-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-panel-close {
  padding: 0;
  font-size: 13px;
  color: #909399;
}

.chart-container {
  display: flex;
  align-items: stretch;
  gap: 20px;
  width: 100%;
  min-height: 560px;
}

.chart-main {
  flex: 1;
  min-width: 0;
}

.chart-side {
  flex: none;
  width: 400px;
}

/* 无数据时隐藏图表区域，但保留 DOM 节点以便后续直接重绘 */
.chart-hidden {
  visibility: hidden;
}

.chart-canvas {
  width: 100%;
  height: 560px;
}

.chart-canvas-sm {
  height: 560px;
}

.chart-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #909399;
  font-size: 17px;
  text-align: center;
}

.chart-container {
  position: relative;
}

/* ===== 添加评价信息弹窗布局 ===== */
.dialog-scroll-body {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 6px;
}

.dialog-scroll-body >>> .el-form-item {
  margin-bottom: 16px;
}

/* 指标表格布局：CSS Grid 三列，标签/指标值/权重纵向严格对齐 */
.metric-grid {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.grid-row {
  display: grid;
  grid-template-columns: 158px 1fr 1fr;
  align-items: start;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #f2f6fc;
}

.grid-row:last-child {
  border-bottom: none;
}

.grid-row:not(.grid-head):hover {
  background: #fafcff;
}

.grid-head {
  align-items: center;
  background: #f5f7fa;
  padding: 9px 14px;
  border-bottom: 1px solid #ebeef5;
}

.grid-col-label {
  color: #606266;
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;
  overflow: visible;
}

.grid-col-label.head {
  color: #909399;
  font-size: 12px;
  line-height: 20px;
}

.grid-col.head {
  color: #909399;
  font-size: 12px;
  line-height: 20px;
}

/* 网格内的表单项：去掉默认label占位与外边距，撑满所在列 */
.grid-col-item {
  margin-bottom: 0 !important;
  display: block;
}

.grid-col-item >>> .el-form-item__content {
  margin-left: 0 !important;
  line-height: 32px;
}

.grid-col-item .el-input,
.grid-col-item .el-select {
  width: 100%;
}

/* 校验错误提示占位，避免撑高行导致错位 */
.grid-col-item >>> .el-form-item__error {
  padding-top: 2px;
  padding-left: 0;
  white-space: nowrap;
}

/* 操作按钮独立成行 */
.action-row {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px dashed #e4e7ed;
}

.action-row .el-button {
  margin-left: 0;
  margin-right: 10px;
}

/* 修复等级结果在弹窗底部左侧普通显示，无颜色强调 */
.footer-grade {
  float: left;
  line-height: 32px;
  color: #606266;
  font-size: 13px;
}
</style>

<style>
/* 非 scoped：el-dialog 使用 append-to-body 挂载到 body 下，
   脱离了组件作用域，因此弹窗样式必须写在全局块里。 */
.evaluate-dialog {
  margin-left: auto !important;
  margin-right: auto !important;
  z-index: 2200 !important;
}

.evaluate-dialog .el-dialog__footer {
  padding: 12px 20px 16px;
}
</style>