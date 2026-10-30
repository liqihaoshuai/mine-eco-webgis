<template>
  <div class="thematic-page">
    <div class="thematic-container">
      <div class="title">专题图展示</div>
      <div class="toolbar">
        <el-button size="mini" icon="el-icon-refresh" :loading="refreshing" @click="refresh">刷新</el-button>
        <el-switch
          v-model="autoRefresh"
          active-text="自动刷新"
          @change="toggleAutoRefresh"
        ></el-switch>
        <span class="toolbar-hint">共 {{ totalImages }} 张专题图</span>
      </div>
      <div v-if="groupedMaps.length" class="gallery-groups">
        <section
          v-for="group in groupedMaps"
          :key="group.mineId"
          class="mine-group"
        >
          <h2 class="group-title">{{ group.label }}</h2>
          <div
            v-for="metricGroup in group.metrics"
            :key="metricGroup.metric"
            class="metric-group"
          >
            <h3 class="metric-title">
              <span class="metric-name">{{ metricGroup.label }}</span>
              <span class="metric-count">{{ metricGroup.total }} 张</span>
            </h3>
            <div
              v-for="sensorGroup in metricGroup.sensors"
              :key="sensorGroup.sensor"
              class="sensor-group"
            >
              <h4 class="sensor-title">{{ sensorGroup.label }}</h4>
              <div class="gallery">
                <div
                  v-for="map in sensorGroup.maps"
                  :key="map.key"
                  class="map-preview"
                  @click="showFullscreen(map)"
                >
                  <div class="map-thumbnail">
                    <img :src="map.image" :alt="map.title" @load="imageLoaded">
                  </div>
                  <div class="map-title">{{ map.title }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!group.metrics.length" class="group-empty">暂无专题图</div>
        </section>
      </div>
      <div v-else class="empty-state">No generated thematic map yet. Run a backend job first.</div>
    </div>

    <div class="preload-container">
      <img
        v-for="(map, index) in thematicMaps"
        :key="`preload-${index}`"
        :src="map.image"
        style="display: none;"
        @load="preloadComplete(index)"
      >
    </div>

    <!--
      append-to-body 必须保留：.thematic-page 与 .thematic-container 都设了 backdrop-filter，
      而 backdrop-filter（与 transform/filter 同理）会让该元素成为 position:fixed 后代的包含块。
      弹窗默认渲染在组件内部，就会相对这个随图库内容变高的页面盒子定位，
      导致滚动后预览仍停在页面顶部而不是视口中央。挂到 body 即可跳出包含块。
    -->
    <el-dialog
      :title="currentMap.title"
      :visible.sync="fullscreenVisible"
      :fullscreen="false"
      width="62%"
      :show-close="true"
      custom-class="thematic-dialog"
      append-to-body
      @close="closeFullscreen"
    >
      <div class="fullscreen-container">
        <div class="image-controls">
          <el-button type="primary" icon="el-icon-zoom-in" circle @click="zoomIn"></el-button>
          <el-button type="primary" icon="el-icon-zoom-out" circle @click="zoomOut"></el-button>
          <el-button type="primary" icon="el-icon-refresh" circle @click="resetZoom"></el-button>
        </div>
        <div class="image-wrapper" @wheel="handleWheel">
          <img
            v-if="currentMap.image"
            :src="currentMap.image"
            :alt="currentMap.title"
            :style="{ transform: `scale(${zoomLevel})` }"
            @mousedown="startPan"
            @mousemove="pan"
            @mouseup="endPan"
            @mouseleave="endPan"
          >
        </div>
        </div>
      <span slot="footer" class="dialog-footer">
        <el-button type="success" icon="el-icon-download" @click="downloadImage">下载</el-button>
        <el-button @click="closeFullscreen">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import DataService from '../services/DataService.js';

export default {
  name: 'ThematicMapGallery',
  data() {
    return {
      fullscreenVisible: false,
      currentMap: {},
      zoomLevel: 1,
      isPanning: false,
      panStartX: 0,
      panStartY: 0,
      translateX: 0,
      translateY: 0,
      loadedImages: 0,
      totalImages: 0,
      thematicMaps: [],
      groupedMaps: [],
      autoRefresh: true,
      refreshing: false,
      refreshTimer: null,
      refreshInterval: 8000,
    };
  },
  async mounted() {
    await this.loadResults();
    this.setupDialogStyle();
    this.startAutoRefresh();
  },
  // App.vue 使用了 <keep-alive>，切换菜单时组件不会销毁重建，
  // 因此必须用 activated / deactivated 控制轮询，并保证每次进入都重新拉取数据。
  activated() {
    this.loadResults({ silent: true });
    this.startAutoRefresh();
  },
  deactivated() {
    this.stopAutoRefresh();
  },
  beforeDestroy() {
    this.stopAutoRefresh();
  },
  methods: {
    startAutoRefresh() {
      this.stopAutoRefresh();
      if (!this.autoRefresh) return;
      this.refreshTimer = setInterval(() => {
        // 页面不可见时跳过轮询，避免后台标签页持续请求。
        if (typeof document !== 'undefined' && document.hidden) return;
        this.loadResults({ silent: true });
      }, this.refreshInterval);
    },
    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
    toggleAutoRefresh(value) {
      if (value) {
        this.startAutoRefresh();
        this.$message.success('已开启自动刷新，每 8 秒检测新专题图');
      } else {
        this.stopAutoRefresh();
      }
    },
    async refresh() {
      this.refreshing = true;
      await this.loadResults();
      this.refreshing = false;
      this.$message.success('专题图已刷新');
    },
    metricOrder(metric) {
      const order = ['fvc', 'vri', 'ndmi', 'ndsi', 'rsei'];
      const index = order.indexOf(String(metric || '').toLowerCase());
      return index === -1 ? order.length : index;
    },
    metricLabel(metric) {
      const labels = {
        fvc: '植被覆盖度FVC',
        vri: '植被恢复指数VRI',
        ndmi: '土壤湿度指数NDMI',
        ndsi: '裸土指数NDSI',
        rsei: '遥感生态指数RSEI',
      };
      return labels[String(metric || '').toLowerCase()] || metric || '未知指标';
    },
    sensorLabel(sensor) {
      const key = String(sensor || '').toLowerCase();
      if (key === 'sentinel2') return 'Sentinel-2';
      if (key === 'landsat89') return 'Landsat 8/9';
      return sensor || '未知数据源';
    },
    mineLabel(mineId) {
      return String(mineId || '').replace('mine', '矿区');
    },
    resolveMineId(item) {
      if (item.mine_id) return String(item.mine_id);
      const mineStats = item.mine_stats || {};
      const source = mineStats.source || {};
      if (source.mine_id) return String(source.mine_id);
      const paths = [item.png_path, item.tif_path, item.input_path, item.input_path_late];
      for (const value of paths) {
        if (!value) continue;
        const parts = String(value).replace(/\\/g, '/').split('/');
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          if (/^mine[123]$/.test(parts[i])) return parts[i];
        }
      }
      return '';
    },
    buildTitle(item) {
      const parts = [];
      if (item.year) parts.push(`${item.year}年`);
      const mineId = this.resolveMineId(item);
      if (mineId) parts.push(this.mineLabel(mineId));
      const metricLabel = this.metricLabel(item.metric);
      if (item.baseline_year) {
        parts.push(`${metricLabel}(基准${item.baseline_year})`);
      } else {
        parts.push(metricLabel);
      }
      return `${parts.join(' · ')} · ${this.sensorLabel(item.sensor)}`;
    },
    async loadResults(options) {
      const silent = options && options.silent;
      try {
        const response = await DataService.getResults();
        const results = response.data.results || [];

        // 同一矿区 + 数据源 + 指标 + 年份 只保留最新的一张图。
        const unique = new Map();
        results.forEach((item) => {
          if (!item.preview_url) return;
          const mineId = this.resolveMineId(item);
          const key = [
            mineId || 'unknown',
            item.sensor || 'default',
            item.metric || 'default',
            item.year || 0,
            item.baseline_year || 0,
          ].join('|');
          const existing = unique.get(key);
          if (!existing || String(item.generated_at || '') > String(existing.item.generated_at || '')) {
            unique.set(key, { item, mineId });
          }
        });

        // 分组：矿区 → 指标 → 数据源 → 年份(倒序)
        const byMine = new Map();
        unique.forEach(({ item, mineId }) => {
          const mineKey = mineId || 'unknown';
          if (!byMine.has(mineKey)) {
            byMine.set(mineKey, { mineId: mineKey, metrics: new Map() });
          }
          const mineGroup = byMine.get(mineKey);
          const metricKey = item.metric || 'default';
          if (!mineGroup.metrics.has(metricKey)) {
            mineGroup.metrics.set(metricKey, { metric: metricKey, sensors: new Map() });
          }
          const metricGroup = mineGroup.metrics.get(metricKey);
          const sensorKey = item.sensor || 'default';
          if (!metricGroup.sensors.has(sensorKey)) {
            metricGroup.sensors.set(sensorKey, []);
          }
          metricGroup.sensors.get(sensorKey).push({
            key: [mineId, item.sensor, item.metric, item.year, item.baseline_year].join('|'),
            image: `http://localhost:5001${item.preview_url}`,
            title: this.buildTitle(item),
            year: item.year || 0,
            generatedAt: item.generated_at,
            metric: item.metric,
            sensor: item.sensor,
            mineId,
          });
        });

        const sensorRank = s => (String(s).toLowerCase() === 'sentinel2' ? 0 : 1);
        const groups = Array.from(byMine.values())
          .sort((a, b) => String(a.mineId).localeCompare(String(b.mineId)))
          .map((mineGroup) => ({
            mineId: mineGroup.mineId,
            label: `${this.mineLabel(mineGroup.mineId)}专题图`,
            metrics: Array.from(mineGroup.metrics.values())
              .sort((a, b) => this.metricOrder(a.metric) - this.metricOrder(b.metric))
              .map((metricGroup) => {
                const sensors = Array.from(metricGroup.sensors.entries())
                  .sort((a, b) => sensorRank(a[0]) - sensorRank(b[0]))
                  .map(([sensor, maps]) => ({
                    sensor,
                    label: this.sensorLabel(sensor),
                    maps: maps.slice().sort((x, y) => y.year - x.year),
                  }));
                const total = sensors.reduce((sum, s) => sum + s.maps.length, 0);
                return {
                  metric: metricGroup.metric,
                  label: this.metricLabel(metricGroup.metric),
                  sensors,
                  total,
                };
              }),
          }));

        this.groupedMaps = groups;
        this.thematicMaps = groups.reduce((acc, group) => acc.concat(
          group.metrics.reduce((outer, metricGroup) => outer.concat(
            metricGroup.sensors.reduce((inner, s) => inner.concat(s.maps), [])
          ), [])
        ), []);
        this.totalImages = this.thematicMaps.length;
        if (!silent && this.thematicMaps.length) {
          this.$message.success(`专题图已更新，共 ${this.totalImages} 张`);
        }
      } catch (error) {
        if (!silent) {
          this.groupedMaps = [];
          this.thematicMaps = [];
          this.totalImages = 0;
        }
      }
    },
    setupDialogStyle() {
      if (!document.getElementById('thematic-dialog-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'thematic-dialog-style';
        styleEl.textContent = `
          .thematic-dialog {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .el-dialog__wrapper {
            animation: none !important;
          }
          .el-dialog {
            animation: none !important;
            transition: none !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    },
    imageLoaded() {},
    preloadComplete() {
      this.loadedImages += 1;
    },
    showFullscreen(map) {
      this.currentMap = { ...map };
      this.$nextTick(() => {
        this.fullscreenVisible = true;
        this.resetZoom();
      });
    },
    closeFullscreen() {
      this.fullscreenVisible = false;
      this.resetZoom();
    },
    zoomIn() {
      if (this.zoomLevel < 3) {
        this.zoomLevel += 0.2;
      }
    },
    zoomOut() {
      if (this.zoomLevel > 0.5) {
        this.zoomLevel -= 0.2;
      }
    },
    resetZoom() {
      this.zoomLevel = 1;
      this.translateX = 0;
      this.translateY = 0;
    },
    handleWheel(event) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    },
    startPan(event) {
      if (this.zoomLevel > 1) {
        this.isPanning = true;
        this.panStartX = event.clientX;
        this.panStartY = event.clientY;
      }
    },
    pan(event) {
      if (!this.isPanning) return;
      const dx = event.clientX - this.panStartX;
      const dy = event.clientY - this.panStartY;
      this.translateX += dx;
      this.translateY += dy;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
    },
    endPan() {
      this.isPanning = false;
    },
    downloadImage() {
      if (!this.currentMap || !this.currentMap.image) return;
      const link = document.createElement('a');
      const fileName = this.currentMap.image.split('?')[0].split('/').pop();
      link.download = `${fileName}`;
      link.href = this.currentMap.image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.$message.success('Download started');
    },
    reload() {
      this.loadResults();
    },
  },
};
</script>

<style scoped>
.thematic-page {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(240, 243, 248, 0.82);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
  padding: 24px 20px;
  box-sizing: border-box;
  z-index: 10;
}

.thematic-container {
  width: 100%;
  max-width: 1560px;
  padding: 28px 32px 34px;
  background-color: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 14px;
  box-shadow: 0 6px 28px rgba(31, 45, 61, 0.14);
  margin: 0 auto;
  box-sizing: border-box;
}

.title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 35px;
  text-align: center;
  color: #333;
  position: relative;
}

.title:after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 4px;
  background-color: #409EFF;
  border-radius: 4px;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.gallery-groups {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(235, 238, 245, 0.9);
}

.toolbar-hint {
  color: #909399;
  font-size: 13px;
}

.mine-group {
  border: 1px solid rgba(235, 238, 245, 0.9);
  border-radius: 12px;
  padding: 16px 20px 20px;
  background: rgba(250, 251, 253, 0.7);
}

.group-title {
  margin: 0 0 16px;
  padding-left: 12px;
  border-left: 4px solid #409EFF;
  font-size: 20px;
  font-weight: 500;
  color: #303133;
}

.metric-group {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px dashed rgba(228, 231, 237, 0.9);
}

.metric-group:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.metric-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.metric-name {
  padding: 3px 10px;
  background: #ecf5ff;
  color: #409EFF;
  border-radius: 4px;
}

.metric-count {
  color: #c0c4cc;
  font-size: 12px;
  font-weight: 400;
}

.sensor-group {
  margin-bottom: 14px;
  padding-left: 14px;
}

.sensor-group:last-child {
  margin-bottom: 0;
}

.sensor-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

.group-empty {
  padding: 24px 0;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.map-preview {
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  border: 1px solid rgba(235, 238, 245, 0.9);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(245, 247, 250, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.map-preview:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.13);
}

.map-thumbnail {
  height: 236px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 247, 250, 0.85);
  overflow: hidden;
}

.map-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s;
}

.map-preview:hover .map-thumbnail img {
  transform: scale(1.04);
}

.map-title {
  padding: 10px 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  background: rgba(255, 255, 255, 0.85);
  border-top: 1px solid rgba(235, 238, 245, 0.9);
  line-height: 1.5;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
  color: #909399;
  font-size: 16px;
}

.fullscreen-container {
  position: relative;
  height: 700px;
  /* 固定 700px 加上对话框头尾约 850px，在 800px 左右的视口里会超出屏幕，
     那样即使定位正确也无法真正居中；这里按视口高度留出余量（头部+页脚+上下留白约 260px）。 */
  max-height: calc(100vh - 260px);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  overflow: hidden;
}

.image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-wrapper img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  transition: transform 0.3s ease;
  cursor: move;
}

.image-controls {
  position: absolute;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 12px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px 15px;
  border-radius: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.close-btn i {
  color: #333;
  font-size: 26px;
}

.close-btn:hover i {
  color: #fff;
}

.preload-container {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

@media (max-width: 1500px) {
  .thematic-container {
    max-width: 1280px;
    padding: 26px 26px 30px;
  }

  .map-thumbnail {
    height: 210px;
  }
}

@media (max-width: 1200px) {
  .thematic-container {
    max-width: 1080px;
  }

  .gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .map-thumbnail {
    height: 200px;
  }
}

@media (max-width: 900px) {
  .gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .map-thumbnail {
    height: 180px;
  }

  .fullscreen-container {
    height: 500px;
  }
}

@media (max-width: 600px) {
  .gallery {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .map-thumbnail {
    height: 200px;
  }

  .title {
    font-size: 22px;
    margin-bottom: 25px;
  }

  .fullscreen-container {
    height: 400px;
  }
}
</style>
