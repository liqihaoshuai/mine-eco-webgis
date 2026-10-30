<template>
  <div class="metric-panel">
    <div class="panel-title">VRI 植被恢复指数</div>
    <el-select v-model="sensor" size="small" style="width: 150px; margin-bottom: 10px;" @change="clearResult">
      <el-option
        v-for="item in sensorOptions"
        :key="item.id"
        :label="item.optionLabel"
        :value="item.id"
      ></el-option>
    </el-select>
    <el-select v-model="mineId" size="small" style="width: 150px; margin-bottom: 10px;" placeholder="选择矿区" @change="clearResult">
      <el-option
        v-for="item in mineOptions"
        :key="item.id"
        :label="item.name"
        :value="item.id"
      ></el-option>
    </el-select>
    <el-select v-model="year" size="small" style="width: 150px; margin-bottom: 10px;" placeholder="选择年份" @change="clearResult">
      <el-option v-for="item in yearOptions" :key="item" :label="String(item)" :value="item"></el-option>
    </el-select>
    <el-button :loading="loading" :disabled="loading" @click="query" style="width: 150px;">计算 VRI</el-button>
    <p v-if="resultText" class="metric-result">{{ resultText }}</p>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import config from '../assets/config.js';
import { publishWMSLayer, describeRequestError } from '../assets/utils.js';
import DataService from '../services/DataService.js';

export default {
name: 'vri',
  data() {
    return {
      config,
      sensor: config.sensorIds()[0],
      mineId: config.mineIds()[0],
      year: config.latestYear(),
      yearOptions: config.availableYears(),
      mineOptions: config.mines,
      sensorOptions: config.sensors,
      loading: false,
      resultText: '',
    };
  },
  computed: {
    ...mapState(['map']),
    // 基准期固定为可选年份中最早的一年，不再由用户手动选择。
    earliestYear() {
      const years = (this.yearOptions || []).map(Number).filter(Number.isFinite);
      return years.length ? Math.min(...years) : null;
    },
  },
  methods: {
    clearResult() {
      this.resultText = '';
    },
    async query() {
      this.resultText = '';
      if (this.loading) return;
      const baselineYear = Number(this.earliestYear);
      if (!Number.isFinite(baselineYear)) {
        this.$message.warning('没有可用的基准年份。');
        return;
      }
      if (baselineYear >= Number(this.year)) {
        this.$message.warning(`最早年份 ${baselineYear} 不早于评价年份 ${this.year}，无法计算 VRI。`);
        return;
      }
      const imagePathEarly = this.sensor === 'sentinel2'
        ? config.sentinelVriRaster(baselineYear)
        : config.landsatVriRaster(baselineYear);
      const imagePathLate = this.sensor === 'sentinel2'
        ? config.sentinelVriRaster(this.year)
        : config.landsatVriRaster(this.year);

      this.loading = true;
      const loadingMsg = this.$message({ type: 'info', message: '正在计算 VRI...', duration: 0 });
      try {
        const response = await DataService.process_vri(
          imagePathEarly,
          imagePathLate,
          this.sensor,
          this.year,
          baselineYear,
          config.mineAreaPath,
          config.mineNameField,
          this.mineId
        );
        if (response.data.error) {
          this.$message.error('处理失败：' + response.data.error);
          return;
        }

        const result = response.data.result || {};
        const stats = result.stats || {};
        const publish = result.publish || {};
        if (!publish.layer_name) {
          this.$message.warning('处理完成，但后端未返回 VRI 已发布图层名称。');
          return;
        }
        const mean = Number((response.data.vri_mean != null ? response.data.vri_mean : stats.mean) || 0);
        const sensorLabel = this.sensor === 'sentinel2' ? 'Sentinel-2' : 'Landsat 8/9';
        this.resultText = `${this.year}年${this.mineId.replace('mine', '矿区')}的VRI均值为 ${mean.toFixed(4)}（${sensorLabel}数据计算；对比最早年份${baselineYear}）`;

        publishWMSLayer(
          this.map,
          publish.wms_url || config.geoServerWMS,
          publish.layer_name
        );
        this.$message.success(`VRI 计算完成，均值 ${mean.toFixed(4)}，图层已发布并加载。`);
      } catch (error) {
        this.$message.error(describeRequestError(error, '请求失败，请检查后端服务。'));
      } finally {
        this.loading = false;
        if (loadingMsg) loadingMsg.close();
      }
    },
  },
};
</script>

<style scoped>
/* 面板定位（贴右侧，右边缘与页头「清除图层」按钮对齐）：
   按钮右边缘 = 页头内边距 20px + margin-right 20px = 距可视区右边 40px。
   --viewport-width 由 utils 的 installViewportWidthVar() 写入，
   取自 documentElement.clientWidth（不含垂直滚动条），与按钮基准一致；
   不用 100vw 是因为 vw 含滚动条宽度，会让面板多右偏约 15~17px。
   也不用 right:40px，是因为链路上有带 transform/filter 的祖先，
   使 fixed 的包含块不是视口，right 会算错。
   left = 可视宽度 - 40px - 面板总宽 */
.metric-panel {
  width: 300px;
  max-width: calc(100vw - 32px);
  min-height: 0;
  box-sizing: border-box;
  padding: 16px 18px 18px;
  background: rgba(255, 255, 255, 0.95);
  position: fixed;
  left: calc(var(--viewport-width, 100vw) - 340px);
  top: 100px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.22);
  z-index: 5;
}
.metric-panel .panel-title {
  margin: 0 0 14px;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.metric-panel .el-select,
.metric-panel .el-button {
  display: block;
  width: 100% !important;
  margin: 0 auto 10px;
}
.metric-panel .el-button {
  min-height: 36px;
  margin-bottom: 0;
}
.metric-panel .metric-result {
  max-height: 72px;
  margin: 12px 0 0;
  padding: 8px 10px;
  overflow: auto;
  color: #2f6f4e;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
  text-align: left;
  word-break: break-word;
  background: #f0f9f3;
  border: 1px solid #cce8d5;
  border-radius: 4px;
}
.metric-panel p {
  max-height: 72px;
  margin: 12px 0 0;
  overflow: auto;
  color: #606266;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  word-break: break-word;
}
@media (max-width: 600px) {
  .metric-panel {
  right: 12px;
    left: 12px;
    width: auto;
    max-width: none;
  }
}
</style>
