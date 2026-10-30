<template>
  <div class="mine-view-panel">
    <div class="panel-head">
      <span class="panel-title">矿区查看</span>
    </div>

    <el-form label-width="66px" size="small">
      <el-form-item label="年份">
        <el-select v-model="year" @change="handleYearChange">
          <el-option v-for="item in yearOptions" :key="item" :label="String(item)" :value="item"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="数据源">
        <el-select v-model="sensor" @change="handleSensorChange">
          <el-option
            v-for="item in sensorOptions"
            :key="item.id"
            :label="item.optionLabel"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="矿区">
        <el-select v-model="mineId">
          <el-option
            v-for="item in mineOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item>
    </el-form>

    <el-button
      type="primary"
      class="panel-primary"
      :loading="processing"
      :disabled="processing"
      @click="publishMine"
    >显示矿区影像</el-button>

    <div class="button-row">
      <el-button :loading="processing" :disabled="processing" @click="processTerrain('elevation')">高程</el-button>
      <el-button :loading="processing" :disabled="processing" @click="processTerrain('slope')">坡度</el-button>
      <el-button :loading="processing" :disabled="processing" @click="processTerrain('aspect')">坡向</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import config from '../assets/config.js';
import DataService from '../services/DataService.js';
import { publishWMSLayer, fitMapToLayers, clearMineImageryLayers, describeRequestError } from '../assets/utils.js';

export default {
name: 'kuangqv',
  computed: {
    ...mapState(['map'])
  },
  data() {
    return {
      config,
      year: config.latestYear(),
      yearOptions: config.availableYears(),
      sensor: config.sensorIds()[0],
      mineId: config.mineIds()[0],
      mineOptions: config.mines,
      sensorOptions: config.sensors,
      processing: false,
      processedCount: 0,
      publishedCount: 0
    };
  },
  methods: {
    async processTerrain(operation) {
      if (this.processing) return;
      const operationLabel = { elevation: '高程', slope: '坡度', aspect: '坡向' }[operation];
      const demPath = config.mineDemPath;
      const clipPath = config.mineClipPath(this.mineId);
      if (!demPath) {
        this.$message.error('未配置 DEM 文件路径');
        return;
      }
      if (!clipPath) {
        this.$message.error('当前矿区没有配置裁剪面路径');
        return;
      }
      this.processing = true;
      const loadingMsg = this.$message({
        type: 'info',
        message: `正在处理${operationLabel}：投影 DEM、按矿区裁剪并计算...`,
        duration: 0
      });
      try {
        const response = await DataService.processMineTerrain({
          year: this.year,
          mine_id: this.mineId,
          operation,
          dem_path: demPath,
          clip_path: clipPath,
          target_crs: config.mineTargetCrs,
          output_dir: config.mineRasterOutputDir
        });
        const result = response.data || {};
        if (result.publish && result.publish.published && result.layer_name) {
          publishWMSLayer(this.map, result.wms_url || config.geoServerWMS, result.layer_name);
        }
        if (result.publish && result.publish.published) {
          this.$message.success(`${operationLabel}处理完成，已发布并加载图层。`);
        } else {
          const reason = (result.publish || {}).reason || '未知原因';
          this.$message.warning(`${operationLabel}计算完成，但 GeoServer 发布失败：${reason}`);
        }
      } catch (error) {
        this.$message.error(describeRequestError(error, `${operationLabel}处理失败，请检查 DEM、矿区面和后端服务。`));
      } finally {
        this.processing = false;
        if (loadingMsg) loadingMsg.close();
      }
    },
    handleSensorChange() {
      // 仅切换数据源：清空已加载的影像图层，不在此处做任何文字提示，
      // 处理与发布的结果统一由“显示矿区”触发的弹窗反馈。
      if (this.processing) return;
      clearMineImageryLayers(this.map);
      this.processedCount = 0;
      this.publishedCount = 0;
    },
    handleYearChange() {
      // 年份仅作为待处理参数，不因切换选择框而自动请求后端。
      // 处理、发布成功或失败统一在点击“显示矿区”后通过弹窗提示。
      if (this.processing) return;
      clearMineImageryLayers(this.map);
      this.processedCount = 0;
      this.publishedCount = 0;
    },
    async publishMine() {
      if (this.processing) return;
      await this.processAndPublish();
    },
    async processAndPublish() {
      if (this.processing) return;
      if (!config.mineClipPath(this.mineId)) {
        this.$message.error('当前矿区没有配置裁剪面路径');
        return;
      }
      this.processing = true;
      // 不在这里清空影像图层：切换矿区后再次发布，应保留已加载的其他矿区，
      // 便于多个矿区同屏对比。同一矿区的同名图层由 publishWMSLayer 内部替换。
      const sensorLabel = this.sensor === 'sentinel2' ? '哨兵二号 Sentinel-2' : 'Landsat 8/9';
      this.processedCount = 0;
      this.publishedCount = 0;
      const loadingMsg = this.$message({
        type: 'info',
        message: `正在处理 ${this.year} 年 ${sensorLabel}：统一投影、按矿区裁剪并发布...`,
        duration: 0
      });
      try {
        const response = await DataService.processMineRasters({
          year: this.year,
          mine_id: this.mineId,
          sensor: this.sensor,
          source_dir: config.mineRasterSourceDir(this.year),
          clip_path: config.mineClipPath(this.mineId),
          target_crs: config.mineTargetCrs,
          output_dir: config.mineRasterOutputDir,
          publish: true
        });
        const result = response.data || {};
        if (result.sensor !== this.sensor) {
          throw new Error(
            `后端当前未按所选数据源处理：前端选择 ${this.sensor}，后端返回 ${result.sensor || '未返回数据源'}。请重启 Flask 后端服务后重试。`
          );
        }
        this.processedCount = Number(result.processed_count || 0);
        this.publishedCount = Number(
          result.published_count != null
            ? result.published_count
            : (result.results || []).filter(item => item.publish && item.publish.published).length
        );
        // 「显示矿区」一次可能发布多个年份/数据源的图层，
        // 逐个定位会让地图来回跳动，所以先全部加载（fit:false），
        // 最后按所有图层的合并范围做一次定位。
        const publishedLayers = [];
        (result.results || []).forEach(item => {
          if (item.publish && item.publish.published && item.layer_name) {
            publishWMSLayer(this.map, item.wms_url || config.geoServerWMS, item.layer_name, '', { fit: false });
            publishedLayers.push(item.layer_name);
          }
        });
        if (publishedLayers.length) {
          // 已加载的其他矿区/地形图层也纳入定位范围，避免切矿区后视野只剩新矿区。
          const fitLayers = publishedLayers.slice();
          this.map.eachLayer(layer => {
            const name = layer._webgisLayerName;
            if (name && fitLayers.indexOf(name) === -1) {
              fitLayers.push(name);
            }
          });
          // refresh:true —— 这批图层是刚发布的，缓存的能力文档里还没有它们。
          fitMapToLayers(this.map, config.geoServerWMS, fitLayers, { maxZoom: 15, refresh: true });
        }
        const publishFailures = result.publish_failures || [];
        const fallbackFailures = (result.results || [])
          .filter(item => item.publish && item.publish.published !== true)
          .map(item => ({
            store_name: item.store_name,
            reason: item.publish_reason || 'GeoServer 未返回成功状态'
          }));
        const failureItems = publishFailures.length ? publishFailures : fallbackFailures;
        const failureDetail = failureItems.length
          ? failureItems.map(item => `${item.store_name || '图层'}：${item.reason}`).join('；')
          : '';
        if (this.publishedCount === 0) {
          const reason = failureDetail ? `原因：${failureDetail}` : '请检查 GeoServer 服务和 REST 配置。';
          this.$message.error(`已处理 ${this.processedCount} 个 ${sensorLabel} 栅格，但没有图层发布成功。${reason}`);
        } else if (result.failed_count || result.publish_failed_count) {
          const failedCount = Number(result.failed_count || 0) + Number(result.publish_failed_count || 0);
          this.$message.warning(`处理完成：成功发布 ${this.publishedCount} 个图层，${failedCount} 个图层发布或处理失败。`);
        } else {
          this.$message.success(`处理完成：${this.year} 年 ${sensorLabel} 已统一投影、裁剪并上传发布。`);
        }
      } catch (error) {
        this.$message.error(describeRequestError(error, '后端处理失败，请检查原始栅格目录、裁剪面和 GeoServer 配置。'));
      } finally {
        this.processing = false;
        if (loadingMsg) loadingMsg.close();
      }
    }
  }
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
.mine-view-panel {
  width: 360px;
  max-width: calc(100vw - 32px);
  min-height: 0;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.94);
  position: fixed;
  left: calc(var(--viewport-width, 100vw) - 400px);
  top: 100px;
  padding: 16px 18px 18px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.22);
  z-index: 5;
}
.mine-view-panel .panel-head {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 14px;
}
.mine-view-panel .panel-title {
  color: #303133;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
}
.mine-view-panel .el-form {
  width: 100%;
}
.mine-view-panel .el-form-item {
  margin-bottom: 12px;
}
.mine-view-panel .el-form-item__label {
  color: #606266;
  font-weight: 500;
}
.mine-view-panel .el-select {
  width: 100% !important;
}
.mine-view-panel .panel-primary {
  display: block;
  min-width: 126px;
  margin: 2px auto 14px;
}
.mine-view-panel .button-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.mine-view-panel .button-row .el-button {
  width: 74px;
  min-width: 74px;
  margin-left: 0;
  padding: 9px 12px;
  white-space: nowrap;
}
@media (max-width: 600px) {
  .mine-view-panel {
  right: 12px;
    left: 12px;
    width: auto;
    max-width: none;
  }
}
</style>
