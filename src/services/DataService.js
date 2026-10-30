//  导入axios
import axios from 'axios';

// 创建一个 axios 实例，用于发送请求
const apiClient = axios.create({
  // 设置后端 API 的基础 URL
  baseURL: 'http://localhost:5001',
  // 超时设置（毫秒）
  timeout: 30000,
  // 设置请求头
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  // 允许跨域携带凭证
  withCredentials: false
});

// 添加请求拦截器
apiClient.interceptors.request.use(
  config => {
    // 在发送请求前做一些处理
    console.log('发送请求:', config.url);
    return config;
  },
  error => {
    // 请求错误处理
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 添加响应拦截器
apiClient.interceptors.response.use(
  response => {
    // 对响应数据做处理
    return response;
  },
  error => {
    // 对响应错误做处理
    console.error('响应错误:', error);
    // 如果是跨域错误，提供更具体的错误信息
    if (error.message.includes('Network Error') || !error.response) {
      console.error('可能是跨域问题或服务器未响应');
    }
    return Promise.reject(error);
  }
);

// 定义一个用于获取数据的函
export default {
  getResults(params = {}) {
    return apiClient.get('/api/results', { params });
  },
  getEvaluationRecords(params = {}) {
    return apiClient.get('/api/evaluation-records', { params });
  },
  getMineStats(metric, params = {}) {
    return apiClient.get(`/api/results/${metric}/mine-stats`, { params });
  },
  getMineRasterConfig() {
    return apiClient.get('/api/mine-raster/config');
  },
  processMineRasters(payload) {
    return apiClient.post('/api/mine-raster/process', payload);
  },
  processMineTerrain(payload) {
    return apiClient.post('/api/mine-raster/terrain', payload);
  },
  getProcessedMineRasters(year, mineId) {
    return apiClient.get('/api/mine-raster/processed', {
      params: { year, mine_id: mineId },
    });
  },
  process_rsei(rasterPath, year, mineAreaPath = '', nameField = '', mineId = '', processedRasterPath = '') {
    return apiClient.post('/api/process_rsei', {
      raster_path: rasterPath,
      sensor: 'landsat89',
      year,
      mine_id: mineId || undefined,
      processed_raster_path: processedRasterPath || undefined,
      mine_area_path: mineAreaPath || undefined,
      name_field: nameField || undefined,
    });
  },
  process_fvc(rasterPath, sensor = 'landsat89', year = null, mineAreaPath = '', nameField = '', mineId = '', processedRasterPath = '') {
    return apiClient.post('/api/process_fvc', {
      raster_path: rasterPath,
      sensor,
      year,
      mine_id: mineId || undefined,
      processed_raster_path: processedRasterPath || undefined,
      mine_area_path: mineAreaPath || undefined,
      name_field: nameField || undefined,
    });
  },
  process_vri(imagePathEarly, imagePathLate, sensor = 'landsat89', year = null, baselineYear = null, mineAreaPath = '', nameField = '', mineId = '', processedEarlyPath = '', processedLatePath = '') {
    return apiClient.post('/api/process_vri', {
      image_path_early: imagePathEarly,
      image_path_late: imagePathLate,
      sensor,
      year,
      baseline_year: baselineYear,
      mine_id: mineId || undefined,
      processed_raster_path_early: processedEarlyPath || undefined,
      processed_raster_path_late: processedLatePath || undefined,
      mine_area_path: mineAreaPath || undefined,
      name_field: nameField || undefined,
    });
  },
  process_ndmi(rasterPath, sensor = 'landsat89', year = null, mineAreaPath = '', nameField = '', mineId = '', processedRasterPath = '') {
    return apiClient.post('/api/process_ndmi', {
      image_path: rasterPath,
      sensor,
      year,
      mine_id: mineId || undefined,
      processed_raster_path: processedRasterPath || undefined,
      mine_area_path: mineAreaPath || undefined,
      name_field: nameField || undefined,
    });
  },
  process_ndsi(rasterPath, sensor = 'landsat89', year = null, mineAreaPath = '', nameField = '', mineId = '', processedRasterPath = '') {
    return apiClient.post('/api/process_ndsi', {
      image_path: rasterPath,
      sensor,
      year,
      mine_id: mineId || undefined,
      processed_raster_path: processedRasterPath || undefined,
      mine_area_path: mineAreaPath || undefined,
      name_field: nameField || undefined,
    });
  },
};
