import L from 'leaflet';
import axios from 'axios';
import store from '../store/store.js';

/**
 * 从图层名推断对应的图例指标 key。
 * 图层名形如 2026_mine1_FVC_sentinel2 / auto_elevation_store 等，
 * 统一转为小写后按关键词匹配；识别不到时返回 null（不显示图例）。
 * 注意匹配顺序：slope/aspect 必须先于 elevation 判断，
 * 否则 aspect 图层名里若含 dem 字样会被误判为高程。
 */
export function inferLegendKey(layerName) {
  const lower = String(layerName || '').toLowerCase();
  if (!lower) return null;

  const metrics = ['fvc', 'vri', 'ndmi', 'ndsi', 'rsei'];
  for (let i = 0; i < metrics.length; i += 1) {
    const key = metrics[i];
    if (lower.indexOf('_' + key) >= 0 || lower.endsWith(key)) return key;
  }
  if (lower.indexOf('slope') >= 0) return 'slope';
  if (lower.indexOf('aspect') >= 0) return 'aspect';
  if (lower.indexOf('elevation') >= 0) return 'elevation';
  return null;
}
/** 
export function deleteShpLayer(map) {
  if (map) {
    map.eachLayer(layer => {
      // 检查图层是否为矢量图层（GeoJSON 或 WFS 图层）
      if (layer instanceof L.GeoJSON) {
        map.removeLayer(layer);
      }
    });
  }
}
*/

/**
 * 将请求/处理异常转换为可直接展示给用户的提示文案。
 * 重点是把 axios 原始的 “Network Error”“timeout” 等英文技术报错翻译成可读中文，
 * 避免把技术细节直接抛给用户；后端返回的 error 字段与业务异常文案保持原样。
 * @param {Error} error - 捕获到的异常对象
 * @param {string} fallback - 无法识别时使用的兜底文案
 * @returns {string} 可直接用于 $message / $alert 的提示文案
 */
export function describeRequestError(error, fallback = '操作失败，请稍后重试。') {
  const data = error && error.response && error.response.data ? error.response.data : null;
  if (data) {
    const serverMessage = data.error || data.message;
    if (serverMessage) return String(serverMessage);
    return fallback;
  }

  const raw = error && error.message ? String(error.message) : '';
  if (/network\s*error/i.test(raw)) {
    return '无法连接后端服务（Network Error）：请确认后端服务已启动、端口可访问，并检查跨域或代理设置后重试。';
  }
  if (/timeout/i.test(raw)) {
    return '请求超时：后端处理耗时长或服务无响应，请稍后重试。';
  }
  if (!raw) return fallback;
  // 业务层主动抛出的异常（如数据源不一致）保留原始文案
  return raw;
}

export function clearNonBaseLayers(map) {
  if (!map) {
    console.error('Map is not defined');
    return;
  }

  // 定义底图 URL
  const baseMapUrls = [
    'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510', // 天地图卫星影像
    'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510', // 天地图标注
  ];

  // 遍历所有图层
  map.eachLayer(layer => {
    // 判断是否为底图图层
    const isBaseLayer = baseMapUrls.some(url => layer._url && layer._url.includes(url));

    // 移除非底图图层
    if (!isBaseLayer) {
      map.removeLayer(layer);
    }
  });

  // 专题图层已全部移除，右下角图例同步隐藏
  store.commit('setActiveLegend', null);
}

/**
 * 发布 WMS 图层
 * @param {L.Map} map - Leaflet 地图实例
 * @param {string} wmsUrl - WMS 服务地址
 * @param {string} layerName - 图层名称
 * @param {Object} options - 其他选项
 * @param {string} options.sldUrl - SLD 文件的 URL（可选）
 * @returns {L.TileLayer.WMS|null} - 返回 WMS 图层实例，失败时返回 null
 */
export function clearMineImageryLayers(map) {
  if (!map) return;

  const imageryLayers = [];
  map.eachLayer(layer => {
    const layerName = layer._webgisLayerName
      || (layer.wmsParams && layer.wmsParams.layers)
      || (layer.options && layer.options.layers)
      || '';
    const text = String(layerName).toLowerCase();
    if (text.includes('landsat89_') || text.includes('sentinel2_')) {
      imageryLayers.push(layer);
    }
  });
  imageryLayers.forEach(layer => map.removeLayer(layer));
}

/**
 * 把「可视区宽度」写进 CSS 变量 --viewport-width，供面板定位使用。
 *
 * 为什么不直接在 CSS 里用 100vw：vw 包含垂直滚动条的宽度，
 * 而页头「清除图层」按钮是按可视宽度（不含滚动条）算的，
 * 用 100vw 会让面板比按钮多往右偏出一个滚动条的宽度（约 15~17px）。
 * documentElement.clientWidth 恰好是不含滚动条的可视宽度，与按钮基准一致。
 * @returns {Function} 取消监听并清理变量的函数
 */
export function installViewportWidthVar() {
  if (typeof document === 'undefined') return () => {};

  const root = document.documentElement;
  const sync = () => {
    root.style.setProperty('--viewport-width', `${root.clientWidth}px`);
  };
  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);

  return () => {
    window.removeEventListener('resize', sync);
    window.removeEventListener('orientationchange', sync);
    root.style.removeProperty('--viewport-width');
  };
}

/**
 * WMS GetCapabilities 缓存：同一个服务地址只拉取一次，
 * 避免每次发布图层都重新请求一遍能力文档。
 */
const wmsCapabilitiesCache = new Map();

function fetchWmsCapabilities(wmsUrl, forceRefresh = false) {
  if (forceRefresh) {
    wmsCapabilitiesCache.delete(wmsUrl);
  }
  if (!wmsCapabilitiesCache.has(wmsUrl)) {
    const promise = axios
      .get(wmsUrl, {
        params: { service: 'WMS', version: '1.1.1', request: 'GetCapabilities' },
        responseType: 'text',
        transformResponse: [data => data],
      })
      .then(response => (typeof response.data === 'string' ? response.data : String(response.data || '')))
      .catch(error => {
        // 能力文档取不到不影响图层本身显示，仅跳过自动定位。
        console.warn('读取 WMS GetCapabilities 失败，跳过自动定位：', error);
        return '';
      });
    wmsCapabilitiesCache.set(wmsUrl, promise);
  }
  return wmsCapabilitiesCache.get(wmsUrl);
}

/**
 * 从 GetCapabilities 文档中解析指定图层的经纬度范围。
 * 兼容 WMS 1.1.1 的 LatLonBoundingBox 与 1.3.0 的 EX_GeographicBoundingBox；
 * 图层名同时按「带工作区前缀」和「不带前缀」两种写法匹配。
 * @returns {L.LatLngBounds|null} 多个图层时返回合并后的范围
 */
function parseLayerBounds(xml, layerNames) {
  if (!xml || typeof DOMParser === 'undefined') return null;
  const wanted = layerNames
    .map(name => String(name || '').trim().toLowerCase())
    .filter(Boolean)
    .map(name => (name.includes(':') ? name.split(':').pop() : name));
  if (!wanted.length) return null;

  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const layers = doc.getElementsByTagName('Layer');
  let bounds = null;

  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const nameEl = layer.getElementsByTagName('Name')[0];
    const fullName = nameEl ? nameEl.textContent.trim().toLowerCase() : '';
    if (!fullName) continue;
    const shortName = fullName.includes(':') ? fullName.split(':').pop() : fullName;
    if (wanted.indexOf(shortName) < 0) continue;

    let west, south, east, north;
    const llbb = layer.getElementsByTagName('LatLonBoundingBox')[0];
    if (llbb) {
      west = parseFloat(llbb.getAttribute('minx'));
      south = parseFloat(llbb.getAttribute('miny'));
      east = parseFloat(llbb.getAttribute('maxx'));
      north = parseFloat(llbb.getAttribute('maxy'));
    } else {
      const ex = layer.getElementsByTagName('EX_GeographicBoundingBox')[0];
      if (ex) {
        const pick = tag => {
          const el = ex.getElementsByTagName(tag)[0];
          return el ? parseFloat(el.textContent) : NaN;
        };
        west = pick('westBoundLongitude');
        east = pick('eastBoundLongitude');
        south = pick('southBoundLatitude');
        north = pick('northBoundLatitude');
      }
    }
    if (![west, south, east, north].every(value => Number.isFinite(value))) continue;

    const current = L.latLngBounds([[south, west], [north, east]]);
    bounds = bounds && bounds.isValid() ? bounds.extend(current) : current;
  }

  return bounds && bounds.isValid() ? bounds : null;
}

/**
 * 把地图定位到指定 WMS 图层的范围，使图层铺满视野中央。
 * 用于「发布图层后自动跳转到图层所在位置」，多层时取合并范围一次定位。
 * @param {L.Map} map - Leaflet 地图实例
 * @param {string} wmsUrl - WMS 服务地址
 * @param {string|string[]} layerNames - 图层名（可传数组）
 * @param {Object} [options] - { maxZoom, padding, refresh }
 *        refresh=true 时强制重新拉取能力文档（刚发布完新图层时必须这样，
 *        否则拿到的还是不含新图层的旧文档，会解析不到范围而跳过定位）
 * @returns {Promise<boolean>} 是否成功定位
 */
export function fitMapToLayers(map, wmsUrl, layerNames, options = {}) {
  if (!map || !wmsUrl) return Promise.resolve(false);
  const names = (Array.isArray(layerNames) ? layerNames : [layerNames]).filter(Boolean);
  if (!names.length) return Promise.resolve(false);

  const locate = forceRefresh => fetchWmsCapabilities(wmsUrl, forceRefresh).then(xml => {
    const bounds = parseLayerBounds(xml, names);
    if (!bounds) return false;
    map.fitBounds(bounds, {
      padding: options.padding || [40, 40],
      maxZoom: options.maxZoom || 16,
      animate: true,
    });
    return true;
  });

  return locate(!!options.refresh).then(ok => {
    if (ok) return true;
    // 缓存里没有该图层（多为刚发布、缓存已过期），强制刷新后重试一次。
    if (options.refresh) {
      console.warn('未能在最新能力文档中解析出图层范围：', names);
      return false;
    }
    return locate(true).then(retried => {
      if (!retried) console.warn('未能解析出图层范围，跳过自动定位：', names);
      return retried;
    });
  });
}

export function publishWMSLayer(map, wmsUrl, layerName, cqlFilter = '', options = {}) {
  if (!map) {
    console.error('Map is not defined');
    return null;
  }

  if (!wmsUrl || !layerName) {
    console.error('WMS URL or layer name is not defined');
    return null;
  }

  // fit / fitMaxZoom / fitPadding 是本模块自己的定位控制参数，
  // 不能混进 WMS 查询参数发给 GeoServer，先摘出来。
  const {
    fit = true,
    fitMaxZoom = 16,
    fitPadding,
    sldUrl,
    ...wmsOptions
  } = options;

  // 默认选项
  const defaultOptions = {
    format: 'image/png',
    transparent: true,
    version: '1.1.0',
    ...wmsOptions,
  };

  // 如果提供了 CQL_FILTER，添加到参数中
  if (cqlFilter) {
    defaultOptions.cql_filter = cqlFilter;
  }

  // 如果提供了 SLD 文件的 URL，添加到参数中
  if (sldUrl) {
    defaultOptions.styles = sldUrl;
  }

  try {
    // 同一个专题图重复点击时，先移除旧图层再重新加载，避免重复图层叠加后看起来像“没有反应”。
    const oldLayers = [];
    map.eachLayer(layer => {
      if (layer._webgisLayerName === layerName) {
        oldLayers.push(layer);
      }
    });
    oldLayers.forEach(layer => map.removeLayer(layer));

    // 创建 WMS 图层。给图层实例记录名称，便于下一次重复点击时准确替换。
    const wmsLayer = L.tileLayer.wms(wmsUrl, {
      layers: layerName,
      ...defaultOptions,
    });
    wmsLayer._webgisLayerName = layerName;
    wmsLayer._webgisWmsUrl = wmsUrl;
    wmsLayer.addTo(map);

    // 记录当前活跃的指标图层，供地图右下角图例联动显示。
    // 无法识别为评价指标/地形指标时（如真彩色影像）不显示图例。
    const legendKey = inferLegendKey(layerName);
    if (legendKey) {
      store.commit('setActiveLegend', { key: legendKey, layerName });
    } else {
      store.commit('setActiveLegend', null);
    }

    // 发布成功后自动把地图定位到该图层：无论底图当前在哪儿，
    // 都把新发布的图层摆到视野中央。批量发布时可传 fit:false 由调用方做一次合并定位。
    // refresh:true —— 图层刚发布，缓存的 GetCapabilities 里还没有它，必须重新拉取。
    if (fit) {
      fitMapToLayers(map, wmsUrl, [layerName], {
        maxZoom: fitMaxZoom,
        padding: fitPadding,
        refresh: true,
      });
    }

    return wmsLayer;
  } catch (error) {
    console.error('Error loading WMS layer:', error);
    return null;
  }
}



/**
 * 发布 WFS 图层
 * @param {L.Map} map - Leaflet 地图对象
 * @param {string} wfsUrl - WFS 服务地址
 * @param {string} layerName - 图层名称
 * @param {string} cqlFilter - 查询过滤器（可选）
 * @param {Object} style - 图层样式（可选）
 * @returns {L.GeoJSON} - 返回 GeoJSON 图层对象
 */

export function publishWFSLayer(map, wfsUrl, layerName, cqlFilter = '', styleFunction = null, onEachFeatureFunction = null, sldBody = null) {
  if (!map) {
    console.error('Map is not defined');
    return null;
  }

  if (!wfsUrl || !layerName) {
    console.error('WFS URL or layer name is not defined');
    return null;
  }

  // 如果有传递 sldBody，则在请求中加入 sldBody
  const url = `${wfsUrl}?service=WFS&version=1.1.0&request=GetFeature&typeName=${layerName}&outputFormat=application/json${cqlFilter ? `&cql_filter=${encodeURIComponent(cqlFilter)}` : ''}${sldBody ? `&sld_body=${encodeURIComponent(sldBody)}` : ''}`;

  return axios.get(url)
    .then(response => {
      const features = response.data.features;
      if (!features || features.length === 0) {
        console.error('No features found in the WFS response');
        return null;
      }

      // 使用 L.geoJSON 渲染返回的 WFS 数据，并应用自定义样式
      const geoJSONLayer = L.geoJSON(features, {
        style: styleFunction || function (feature) {
          // 默认样式
          return {
            fillColor: '#8FBC8F',
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7,
          };
        },
        onEachFeature: onEachFeatureFunction || function (feature, layer) {
          const properties = feature.properties;
          if (properties.hasOwnProperty('VALUE')) {
            layer.bindPopup("value：" + feature.properties.VALUE);
          } else {
            layer.bindPopup("value：" + feature.properties.VALUE2);
          }
        },
      }).addTo(map);

      // 设置地图视图范围
      map.fitBounds(geoJSONLayer.getBounds());
      return geoJSONLayer;
    })
    .catch(error => {
      console.error('Error fetching data from GeoServer:', error);
      return null;
    });
}

// 仅开发环境：把图层工具挂到 window，便于调试与自动化脚本按图层名直接加载，
// 生产构建时 process.env.NODE_ENV === 'production'，这段不会被打包。
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.__webgisUtils = { publishWMSLayer, fitMapToLayers, clearNonBaseLayers };
}
