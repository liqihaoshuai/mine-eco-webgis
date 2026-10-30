<template>
  <div
    v-if="visible"
    class="map-legend"
    :class="{ 'is-collapsed': collapsed }"
  >
    <div class="legend-head" @click="collapsed = !collapsed">
      <span class="legend-title">{{ styleInfo.label }}</span>
      <span class="legend-badge" :class="badgeClass">{{ directionText }}</span>
      <i class="legend-toggle" :class="collapsed ? 'el-icon-arrow-up' : 'el-icon-arrow-down'"></i>
    </div>

    <div v-show="!collapsed" class="legend-body">
      <!-- 连续型：色带 + 刻度 -->
      <template v-if="styleInfo.type === 'continuous'">
        <div class="legend-ramp" :style="rampStyle"></div>
        <div class="legend-ticks">
          <span v-for="tick in styleInfo.ticks" :key="tick">{{ tick }}</span>
        </div>
        <div v-if="styleInfo.unit" class="legend-unit">单位：{{ styleInfo.unit }}</div>
      </template>

      <!-- 环绕型（坡向）：八方位色块 -->
      <template v-else>
        <div class="legend-sectors">
          <span
            v-for="sector in styleInfo.sectors"
            :key="sector.label"
            class="sector-chip"
          >
            <i class="sector-dot" :style="{ background: sector.color }"></i>{{ sector.label }}
          </span>
        </div>
      </template>

      <div class="legend-desc">{{ styleInfo.description }}</div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import stylesData from '../assets/metric_styles.json';

// 这些页面会用不透明内容整块覆盖地图，此时图例只会成为干扰，直接隐藏。
const HIDE_ON_ROUTES = ['/ThematicMap', '/Evaluate', '/Administrator', '/Audit'];

export default {
  name: 'MapLegend',
  data() {
    return {
      collapsed: false,
      styles: (stylesData && stylesData.metrics) || {},
    };
  },
  computed: {
    ...mapGetters(['getActiveLegend']),
    activeKey() {
      const active = this.getActiveLegend;
      return active && active.key ? active.key : '';
    },
    styleInfo() {
      return this.styles[this.activeKey] || {};
    },
    visible() {
      if (!this.activeKey || !this.styleInfo.label) return false;
      const path = this.$route && this.$route.path ? this.$route.path : '';
      if (HIDE_ON_ROUTES.indexOf(path) >= 0) return false;
      return true;
    },
    directionText() {
      const dir = this.styleInfo.direction;
      if (dir === 'high-good') return '↑ 高值优';
      if (dir === 'low-good') return '↓ 低值优';
      return '描述性';
    },
    badgeClass() {
      const dir = this.styleInfo.direction;
      // 「高值优」与「低值优」都表示有利方向，统一用绿色；
      // 具体朝哪个方向由徽标里的箭头（↑ / ↓）表达，不用颜色区分，
      // 避免低值优被误读成警示色。
      if (dir === 'high-good' || dir === 'low-good') return 'is-good';
      return 'is-neutral';
    },
    // 按 min/max 把每个色阶换算成百分比位置，生成与 SLD 完全一致的渐变
    rampStyle() {
      const stops = this.styleInfo.stops || [];
      if (!stops.length) return {};
      const min = Number(this.styleInfo.min);
      const max = Number(this.styleInfo.max);
      const span = max - min || 1;
      const parts = stops.map(stop => {
        const ratio = (Number(stop.value) - min) / span;
        const percent = Math.min(100, Math.max(0, ratio * 100));
        return `${stop.color} ${percent.toFixed(1)}%`;
      });
      return { background: `linear-gradient(90deg, ${parts.join(', ')})` };
    },
  },
  watch: {
    // 切换图层时自动展开，避免上次折叠后看不到新图例内容
    activeKey() {
      this.collapsed = false;
    },
  },
};
</script>

<style scoped>
.map-legend {
  position: absolute;
  right: 18px;
  bottom: 26px;
  z-index: 2;
  width: 236px;
  padding: 10px 12px 11px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  font-size: 12px;
  user-select: none;
}

.legend-head {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.legend-title {
  font-size: 12px;
  font-weight: 500;
  color: #2f3542;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.legend-badge {
  flex: none;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 15px;
}

.legend-badge.is-good {
  background: #e8f5e9;
  color: #2e7d32;
}

.legend-badge.is-neutral {
  background: #eef1f5;
  color: #5a6b85;
}

.legend-toggle {
  flex: none;
  font-size: 11px;
  color: #909399;
}

.legend-body {
  margin-top: 8px;
}

.legend-ramp {
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.legend-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  color: #7a8290;
  font-size: 10px;
}

.legend-unit {
  margin-top: 4px;
  color: #909399;
  font-size: 10px;
}

.legend-sectors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px 4px;
}

.sector-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #5a6b85;
  font-size: 10px;
  white-space: nowrap;
}

.sector-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: none;
}

.legend-desc {
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px dashed #e4e7ed;
  color: #7a8290;
  font-size: 10px;
  line-height: 1.5;
}

.is-collapsed {
  width: 190px;
  padding-bottom: 9px;
}
</style>
