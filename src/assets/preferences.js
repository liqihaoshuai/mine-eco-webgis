/**
 * 地图显示偏好的统一存取。
 *
 * 主系统（App.vue）与大屏（Dashboard.vue）共用同一个存储键，
 * 这样在一处关闭「地名注记」，另一处看到的也是关闭状态，避免两边表现不一致。
 */

const ANNOTATION_KEY = 'map_annotation_visible';

/** 读取「天地图地名注记」是否显示，默认显示。localStorage 不可用时也不报错。 */
export function readAnnotationVisible() {
  try {
    const saved = localStorage.getItem(ANNOTATION_KEY);
    return saved === null ? true : saved === '1';
  } catch (error) {
    return true;
  }
}

/** 保存「天地图地名注记」显示状态。 */
export function writeAnnotationVisible(visible) {
  try {
    localStorage.setItem(ANNOTATION_KEY, visible ? '1' : '0');
  } catch (error) {
    // 隐私模式下写入失败不影响开关本身
  }
}
