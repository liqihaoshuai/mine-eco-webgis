<template>
  <div>
    <div v-if="!iflogin">
      <div class="login-wrapper">
    <div :class="['login-container', loginActive ? 'active' : '']">
      <div class="switch-wrapper row aCenter jCenter">
        <!-- 左侧品牌区：叠在底图上的深色渐变上，强化系统定位 -->
        <div class="brand-panel">
          <div class="brand-title">露天矿山<br />生态修复遥感监测</div>
          <div class="brand-divider"></div>
          <div class="brand-desc">WebGIS 空间分析 · 遥感指数反演 · 修复效果评估</div>
        </div>
        <div class="btn-wrapper row aCenter jCenter">
          <div
            v-if="loginActive"
            class="txt row aCenter jCenter"
            @click="loginActive = !loginActive"
          >
            去注册
          </div>
          <div
            v-else
            class="txt row aCenter jCenter"
            @click="loginActive = !loginActive"
          >
            去登录
          </div>
        </div>
      </div>
      <div :class="['outerBox', loginActive ? 'active' : '']">
        <div class="container row aCenter jCenter">
          <div class="login" v-show="loginActive">
            <el-form
              :model="loginModel"
              status-icon
              :rules="loginRules"
              ref="loginRef"
              v-loading="loginLoad"
            >
              <div class="title">登录系统</div>
              <p class="title-sub">欢迎回来，请登录后进入遥感监测与综合评价系统</p>
              <el-form-item prop="username">
                <el-input
                  type="text"
                  prefix-icon="el-icon-user"
                  placeholder="请输入账号 / 手机号 / 邮箱"
                  v-model="loginModel.username"
                />
              </el-form-item>
              <el-form-item prop="password">
                <el-input
                  type="password"
                  prefix-icon="el-icon-lock"
                  placeholder="请输入密码"
                  v-model="loginModel.password"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" class="btn-login" @click="handleLogin"
                  >登录</el-button
                >
              </el-form-item>
            </el-form>
          </div>
          <div class="register" v-show="!loginActive">
            <el-form
              :model="registerModel"
              status-icon
              :rules="registerRules"
              ref="registerRef"
            >
              <div class="title">注册账号</div>
              <el-form-item prop="displayName">
                <el-input
                  type="text"
                  prefix-icon="el-icon-user"
                  placeholder="请输入姓名"
                  v-model="registerModel.displayName"
                />
              </el-form-item>
              <el-form-item prop="username">
                <el-input
                  type="text"
                  placeholder="请输入账号 / 手机号 / 邮箱"
                  v-model="registerModel.username"
                />
              </el-form-item>
              <el-form-item prop="email">
                <el-input
                  type="text"
                  placeholder="请输入邮箱地址"
                  v-model="registerModel.email"
                />
              </el-form-item>
              <el-form-item prop="mobile">
                <el-input
                  placeholder="请输入手机号码"
                  v-model="registerModel.mobile"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item prop="password">
                <el-input
                  type="password"
                  prefix-icon="el-icon-lock"
                  placeholder="请输入密码"
                  v-model="registerModel.password"
                />
              </el-form-item>
              <p class="register-role-tip">
                <i class="el-icon-info"></i>
                注册账号固定为普通用户，管理员权限需由管理员在用户管理中授予
              </p>
              <el-form-item>
                <el-button
                  type="primary"
                  class="btn-login"
                  @click="handleRegister"
                >
                  确认注册
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </div>
    </div>
  </div>
    </div>
    <!-- 大屏独立全屏渲染：不套侧边栏，避免被 el-main 的布局挤压 -->
    <Dashboard v-else-if="isDashboard" />
    <el-container v-else>
      <el-header>
        <h1 class="app-header-title">基于WebGIS的露天矿山生态修复遥感监测与综合评价系统</h1>
        <!-- 顶栏操作区：按钮并排靠右，避免被 header 的 space-between 拉开 -->
        <div class="app-header-actions">
          <span v-if="currentUser" class="app-current-user">
            {{ currentUser.displayName || currentUser.username }} · {{ currentUser.role === 'admin' ? '管理员' : '普通用户' }}
          </span>
          <button
            type="button"
            class="app-header-btn is-nav"
            @click="goToRoute('/Dashboard')"
          >返回大屏</button>
          <!-- 地名注记开关：样式与大屏分段选择按钮一致 -->
          <button
            type="button"
            :class="['app-header-btn', 'is-toggle', { active: annotationVisible }]"
            :title="annotationVisible ? '点击隐藏天地图地名注记' : '点击显示天地图地名注记'"
            @click="toggleAnnotation"
          >{{ annotationVisible ? '注记 开' : '注记 关' }}</button>
          <button
            type="button"
            class="app-header-btn is-tool"
            @click="clearNonBaseLayers()"
          >清除图层</button>
        </div>
      </el-header>
      <el-container>
        <el-aside width="226px">
          <el-menu
            :default-active="activeMenuIndex"
            :default-openeds="openedMenuIndexes"
            class="el-menu-vertical-demo"
            @open="handleOpen"
            @close="handleClose"
          >
          <el-menu-item index="0" @click="goToRoute('/kuangqv')">
              <i class="el-icon-menu"></i>
              <span slot="title" class="menu-item-text">矿区查看</span>
            </el-menu-item>

            <el-submenu index="2">
              <template slot="title">
                <i class="el-icon-location"></i>
                <span class="menu-item-text">评价指标计算</span>
              </template>
              <el-menu-item-group>
                <el-menu-item
                  index="2-1"
                  class="menu-item-text"
                  @click="goToRoute('/Coverage')"
                >
                  植被覆盖度FVC
                </el-menu-item>
                <el-menu-item
                  index="2-2"
                  class="menu-item-text"
                  @click="goToRoute('/vri')"
                >
                  植被恢复指数VRI
                </el-menu-item>
                <el-menu-item
                  index="2-3"
                  class="menu-item-text"
                  @click="goToRoute('/ndmi')"
                >
                  土壤湿度指数NDMI
                </el-menu-item>
                <el-menu-item
                  index="2-4"
                  class="menu-item-text"
                  @click="goToRoute('/ndsi')"
                >
                  裸土指数NDSI
                </el-menu-item>

                <el-menu-item
                  index="2-5"
                  class="menu-item-text"
                  @click="goToRoute('/RSEI')"
                >
                  遥感生态指数RSEI
                </el-menu-item>

              </el-menu-item-group>
            </el-submenu>

            <el-menu-item index="3">
              <i class="el-icon-setting"></i>
              <span
                slot="title"
                @click="goToRoute('/ThematicMap')"
                class="menu-item-text"
                >专题图展示</span>
            </el-menu-item>

            <el-menu-item index="4">
              <i class="el-icon-setting"></i>
              <span
                slot="title"
                @click="goToRoute('/Evaluate')"
                class="menu-item-text"
                >矿区生态修复效果评估</span>
            </el-menu-item>

            <el-menu-item index="5" @click="goToRoute('/Audit')">
              <i class="el-icon-location"></i>
              <span slot="title" class="menu-item-text">评估结果验证</span>
            </el-menu-item>

            <el-menu-item index="6" @click="goToRoute('/Administrator')">
              <i class="el-icon-setting"></i>
              <span slot="title" class="menu-item-text">用户管理</span>
            </el-menu-item>

          </el-menu>
        </el-aside>
        <el-main style="position: relative; min-height:calc(100vh - 60px);">
          <!--
            包裹层的样式不能写在 <router-view> 上：
            ① Vue Router 会把 <router-view> 的属性透传给路由组件根元素；
            ② 而 Vue 2.7 的 inheritAttrs 只在 attrs 模块生效，**静态 style 走 style 模块、绕过了该判断**，
               所以组件里写 inheritAttrs:false 也拦不住 position 被行内样式覆盖。
            因此把 position / z-index / 背景统一放到这层包裹 div 上。
            min-height 不能省：专题图展示的根节点是 position:absolute + height:100%，
            包裹层若为 0 高，它的 height:100% 会解析成 0，整个模块塌掉。
          -->
          <div class="route-host">
            <keep-alive>
              <router-view></router-view>
            </keep-alive>
          </div>

          <div
            id="mapContainer"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"
          ></div>

          <!-- 地图右下角颜色图例：随当前加载的指标图层自动切换 -->
          <MapLegend />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import config from './assets/config.js';
import { clearNonBaseLayers, installViewportWidthVar } from './assets/utils.js';
import MapLegend from './components/MapLegend.vue';
import Dashboard from './components/Dashboard.vue';
import { readAnnotationVisible, writeAnnotationVisible } from './assets/preferences.js';
import {
  authenticate,
  registerUser,
  getCurrentUser,
  roleLabel
} from './assets/userStore.js';

export default {
  name: "App",
  components: {
    MapLegend,
    Dashboard,
  },
  data() {
    return {
      isMapEnabled: false,
      loginLoad: false,
      loginModel: { username: 'admin', password: '123456' },
      loginActive: true,
      registerModel: {
        displayName: '',
        username: '',
        email: '',
        mobile: '',
        password: ''
      },
      loginRules: {
        username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
      },
      registerRules: {
        displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
        username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
        password: [{ required: true, min: 6, message: '密码至少6位', trigger: 'blur' }],
        mobile: [{ required: true, validator: this.checkMobile, trigger: 'blur' }],
        email: [{ required: true, validator: this.checkEmail, trigger: 'blur' }]
      },
      // 将 config 变量保存到组件的 data 中
      tiledLayer:null,
      config: config,
      iflogin:false,
      currentUser: getCurrentUser(),
      // 天地图地名注记图层及其显示状态
      annotationLayer: null,
      annotationVisible: true
    };
  },
  computed: {
    // 大屏是独立全屏页面，不套侧边栏与地图容器
    isDashboard() {
      return this.$route && this.$route.path === '/Dashboard';
    },
    // 侧边菜单高亮项跟随当前路由，避免切页后仍高亮“矿区查看”
    activeMenuIndex() {
      const path = String((this.$route && this.$route.path) || '')
        .replace(/^\//, '')
        .toLowerCase();
      const mapping = {
        kuangqv: '0',
        coverage: '2-1',
        vri: '2-2',
        ndmi: '2-3',
        ndsi: '2-4',
        rsei: '2-5',
        thematicmap: '3',
        evaluate: '4',
        audit: '5',
        administrator: '6',
      };
      return mapping[path] || '0';
    },
    // 指标页面需要展开“评价指标计算”子菜单，否则高亮项不可见
    openedMenuIndexes() {
      return this.activeMenuIndex.indexOf('2-') === 0 ? ['2'] : [];
    },
  },
  watch: {
    // 大屏与分析系统互切时，主地图容器会被创建 / 销毁，
    // 需要跟着销毁旧实例并在回到分析系统时重建，否则会拿到空容器。
    isDashboard(isDash) {
      if (isDash) {
        if (this.map) {
          this.map.remove();
          this.map = null;
          this.annotationLayer = null;
          this.$store.commit('setMap', null);
        }
        return;
      }
      if (this.iflogin && !this.map) {
        this.$nextTick(() => this.initializeMap());
      }
    },
  },
  methods: {
    loadCSS(url) {
      // 创建 link 元素
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = url;

      // 将 link 元素添加到 head 中
      document.head.appendChild(link);
    },
    handleLogin() {
      this.$refs.loginRef.validate((valid) => {
        if (!valid) return;

        this.loginLoad = true;
        const result = authenticate(this.loginModel.username, this.loginModel.password);
        if (!result.ok) {
          this.loginLoad = false;
          this.$message.error(result.message);
          return;
        }

        this.currentUser = result.user;
        const navigation = this.$route.path === '/Dashboard'
          ? Promise.resolve()
          : this.$router.push({ path: '/Dashboard' });

        Promise.resolve(navigation)
          .catch(() => {})
          .then(() => {
            this.iflogin = true;
            this.loginLoad = false;
            this.$message.success(`登录成功，欢迎 ${result.user.displayName || result.user.username}`);
          });
      });
    },
    handleRegister() {
      this.$refs.registerRef.validate((valid) => {
        if (!valid) return;
        // 自助注册一律为普通用户，角色不接受前端传参，避免越权注册管理员
        const result = registerUser({
          displayName: this.registerModel.displayName,
          username: this.registerModel.username,
          email: this.registerModel.email,
          mobile: this.registerModel.mobile,
          password: this.registerModel.password
        });
        if (!result.ok) {
          this.$message.error(result.message);
          return;
        }
        this.$message.success(`注册成功，当前账号类型：${roleLabel(result.user.role)}，请登录`);
        this.loginActive = true;
        this.loginModel.username = result.user.username;
        this.loginModel.password = '';
        this.registerModel = {
          displayName: '', username: '', email: '', mobile: '', password: ''
        };
        this.$nextTick(() => {
          if (this.$refs.registerRef) this.$refs.registerRef.resetFields();
        });
      });
    },
    checkEmail(rule, value, callback) {
      if (!value) {
        callback('请输入邮箱');
      } else if (!/^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(value)) {
        callback(new Error('邮箱格式不正确'));
      } else {
        callback();
      }
    },
    checkMobile(rule, value, callback) {
      if (!value) {
        callback('请输入手机号');
      } else if (!/^(13[0-9]|14[5|7]|15[0|1|2|3|4|5|6|7|8|9]|18[0|1|2|3|5|6|7|8|9])\d{8}$/.test(value)) {
        callback(new Error('手机号格式不正确'));
      } else {
        callback();
      }
    },
    setUserInfo(username) {
      let userInfo = {};
      switch (username) {
        case 'admin':
          userInfo = this.getAdminInfo(username);
          break;
        case 'dept':
          userInfo = this.getDeptAdminInfo(username);
          break;
        default:
          userInfo = this.getCommonUserInfo(username);
          break;
      }
      // this.$session.set('userInfo', userInfo);
    },
    getAdminInfo(userName) {
      return {
        userName: userName,
        userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
        userGrade: '4',
        roleCode: [
          'system',
          'system-user',
          'system-setting',
          'system-user:add',
          'system-user:update',
          'system-user:search',
          'system-user:del',
        ],
      };
    },
    getDeptAdminInfo(userName) {
      return {
        userName: userName,
        userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
        userGrade: '3',
        roleCode: ['system', 'system-user', 'system-user:add', 'system-user:update', 'system-user:search'],
      };
    },
    getCommonUserInfo(userName) {
      return {
        userName: userName,
        userAvatar: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
        userGrade: '2',
        roleCode: [],
      };
    },

    addMapLayer(geturl) {
      const map = this.$store.state.map;

      // 定义天地图服务的 URL 模板
      const tiandituUrlTemplate = `https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510`;

      // 使用 L.tileLayer 加载天地图图层
      this.tiledLayer = L.tileLayer(tiandituUrlTemplate, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        transparent: true,
        opacity: 0.6,
        attribution: '© 天地图'
      }).addTo(map);

      this.tiledLayer.bringToFront();
    },

    // 清除非底图图层
    clearNonBaseLayers() {
    if (!this.map) {
      console.error('Map is not initialized');
      return;
    }
    clearNonBaseLayers(this.map); // 调用清除非底图图层的函数
  },

    /**
     * 显示 / 隐藏天地图地名注记图层。
     * 注记压在专题图之上会遮挡色块，出图或截图时常常需要关掉。
     */
    toggleAnnotation() {
      this.annotationVisible = !this.annotationVisible;
      const layer = this.annotationLayer;
      if (layer && this.map) {
        if (this.annotationVisible) {
          layer.addTo(this.map);
          layer.bringToFront();
        } else {
          this.map.removeLayer(layer);
        }
      }
      try {
        writeAnnotationVisible(this.annotationVisible);
      } catch (error) {
        // 写入失败不影响开关本身
      }
    },

  // 处理菜单打开事件
    handleOpen(key, keyPath) {
      console.log(key, keyPath);
    },

    // 处理菜单关闭事件
    handleClose(key, keyPath) {
      console.log(key, keyPath);
    },

    // 路由跳转并添加图层
    goToRoute(route, shouldAddMapLayer) {
      if (route === '/Administrator' && (!this.currentUser || this.currentUser.role !== 'admin')) {
        this.$message.warning('用户管理仅限管理员访问');
        return;
      }
      if (this.$router.currentRoute.path !== route) {
        this.$router.push({ path: route });

        // 如果 shouldAddMapLayer 参数不为空，执行 addMapLayer 方法
        if (shouldAddMapLayer) {
          this.addMapLayer(shouldAddMapLayer);
        }
      }
    },

    // 初始化地图
    initializeMap() {
      // 初始化地图，采用 Web Mercator 投影 (EPSG:3857)
      this.map = L.map('mapContainer', {
        crs: L.CRS.EPSG3857, // 采用 Web Mercator 投影
        center: [39.685, 118.752],
        zoom: 14,
        zoomControl: false
      });

      // 缩放按钮移到右下角；Leaflet 会把它排列在版权署名控件上方。
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);

      // 天地图卫星影像图层
      const tianDiTuSatellite = L.tileLayer(
        'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510',
        {
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          attribution: '© 天地图',
          maxZoom: 18
        }
      );

      // 天地图标注图层
      const tianDiTuLabels = L.tileLayer(
        'https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=b1d544a40894bb694f07402387b87510',
        {
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          attribution: '© 天地图',
          maxZoom: 18
        }
      );

      // 将天地图卫星影像图层添加到地图
      tianDiTuSatellite.addTo(this.map);

      // 保留注记图层引用，供顶栏的显示/隐藏开关控制
      this.annotationLayer = tianDiTuLabels;

      // 注记是否显示：默认显示，读取上次的选择（与大屏共用同一偏好）
      this.annotationVisible = readAnnotationVisible();

      if (this.annotationVisible) {
        // 将天地图标注图层添加到地图，并置于影像底图之上
        tianDiTuLabels.addTo(this.map);
        tianDiTuLabels.bringToFront();
      }

      // 将地图保存到 Vuex store 中
      this.$store.commit("setMap", this.map);
}
  },
  mounted() {
    // 把「不含滚动条的可视宽度」同步到 CSS 变量，供右侧浮层面板定位。
    this.stopViewportSync = installViewportWidthVar();
  },
  beforeDestroy() {
    if (this.stopViewportSync) {
      this.stopViewportSync();
      this.stopViewportSync = null;
    }
  }
};
</script>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

/* 路由承载层：只负责层叠次序，样式不落到路由组件根元素上（见模板注释）。
   - min-height = el-main 的 min-height(100vh-60px) 减去上下 padding(20px×2)，
     否则专题图展示等 position:absolute + height:100% 的模块会塌成 0 高。
   - pointer-events: none —— 本层有了实际高度后会盖在地图上，
     空白处必须让鼠标事件穿透到地图，否则地图无法拖动/缩放；
     其直接子元素（面板、表格等实际内容）再恢复为 auto。
   - 不设 background-color：原有那层 rgba(255,255,255,.8) 在本层高度为 0 时不可见，
     一旦有了高度就会变成覆盖全屏的白色蒙版把地图冲淡，故去掉。 */
.route-host {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 100px);
  pointer-events: none;
}

.route-host > * {
  pointer-events: auto;
}

/* 本项目所有布局都是 100% 宽，地图容器本身也带 overflow:hidden，
   正常情况下不该出现横向滚动条；一旦出现会让可视高度变小、
   地图可视区右侧出现空白，这里直接隐藏掉。
   注意：position:fixed 的元素不会被 html/body 的 overflow 裁剪，
   所以右侧浮层面板不受影响。 */
html,
body {
  overflow-x: hidden;
}
.clearbt {
  z-index: 999;
  position: fixed;
  left: calc(1vh + 200px);
  bottom: 1%;
  grid-column: 1 / -1;
  justify-self: center;
  padding: 10px 20px;
 color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}
.el-header {
  /* 顶栏：浅绿渐变 + 底部细线，比原来整块实心绿更清爽，同时保留绿色识别度 */
  background: linear-gradient(180deg, #f7fbf5 0%, #ebf4e8 100%);
  border-bottom: 1px solid #d9e8d4;
  color: #23331f;
  line-height: 60px; /* 设置行高，使内容垂直居中 */
  font-size: 16px; /* 设置字体大小 */
  padding: 0 22px; /* 添加左右内边距 */
  box-shadow: 0 1px 3px rgba(35, 51, 31, 0.06); /* 添加轻微的阴影效果 */
  display: flex; /* 使用 flex 布局 */
  align-items: center; /* 垂直居中 */
  justify-content: space-between; /* 标题和按钮分别居左和居右 */
}

/* 系统标题：用 h1 语义标签，字号与大屏卡片标题对齐 */
.app-header-title {
  margin: 0;
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: #1f3d1c;
  line-height: 1.3;
  min-width: 0;
  /* 标题变长后在窄窗口下不换行，避免顶栏被撑成两行 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 顶栏右侧操作按钮组：并排排列，不再被 space-between 拉开 */
.app-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.app-current-user {
  color: #6e7d90;
  font-size: 12px;
  white-space: nowrap;
}

.app-header-actions .el-button + .el-button {
  margin-left: 0;
}

/* 主页面顶栏按钮：与大屏顶部年份/数据源控件保持同一套紧凑视觉语言 */
.app-header-btn {
  height: 34px;
  box-sizing: border-box;
  border: 1px solid #dfe3ea;
  border-radius: 6px;
  padding: 0 13px;
  background: #ffffff;
  color: #5a6b85;
  font: inherit;
  font-size: 12px;
  line-height: 32px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.app-header-btn:hover {
  background: #f4f6fa;
  border-color: #cfd6e1;
}

.app-header-btn:focus-visible {
  outline: 2px solid rgba(55, 138, 221, 0.32);
  outline-offset: 2px;
}

.app-header-btn.is-nav {
  color: #378add;
  border-color: #bcdcff;
  background: #f8fbff;
}

.app-header-btn.is-nav:hover {
  color: #2d76c2;
  border-color: #8fc4f5;
  background: #eef7ff;
}

.app-header-btn.is-toggle {
  min-width: 88px;
  background: #ffffff;
}

.app-header-btn.is-toggle.active {
  color: #ffffff;
  border-color: #8e959e;
  background: #92979f;
}

.app-header-btn.is-toggle.active:hover {
  background: #7e858e;
  border-color: #7e858e;
}

.app-header-btn.is-tool {
  color: #ffffff;
  border-color: #f06b6b;
  background: #f06b6b;
}

.app-header-btn.is-tool:hover {
  border-color: #e25555;
  background: #e25555;
}

.el-aside {
  color: #333;
  background: #ffffff;
  border-right: 1px solid #e6ebe4;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  min-height: 100%;
}

/* 侧边菜单：统一使用 13px，保持当前行高与层级间距不变 */
.menu-item-text {
  font-size: 13px;
  letter-spacing: 0.2px;
}

.el-menu-vertical-demo .el-menu-item,
.el-menu-vertical-demo .el-submenu__title {
  height: 50px;
  line-height: 50px;
  margin: 2px 8px;
  border-radius: 6px;
  transition: background-color 0.15s, color 0.15s;
}

/* 一级菜单图标：略放大并统一为柔和绿灰，贴近左侧绿调主题 */
.el-menu-vertical-demo > .el-menu-item > i,
.el-menu-vertical-demo > .el-submenu > .el-submenu__title > i {
  font-size: 17px;
  color: #6f8a66;
  margin-right: 10px;
  width: 18px;
  text-align: center;
}

.el-menu-vertical-demo .el-menu-item:hover,
.el-menu-vertical-demo .el-submenu__title:hover {
  background-color: #f2f8ef;
}

/* 选中项：浅绿底 + 主色文字，替代默认的整条蓝色块 */
.el-menu-vertical-demo .el-menu-item.is-active {
  background-color: #e9f4e5;
  color: #2e7d32;
  font-weight: 500;
}

.el-menu-vertical-demo .el-menu-item.is-active i {
  color: #2e7d32;
}

/* 展开的子菜单整体底色更淡，左侧加一条细线体现层级归属 */
.el-menu-vertical-demo .el-menu--inline {
  background-color: #fafcf8;
  border-radius: 6px;
  border-left: 2px solid #e3efde;
  margin: 0 8px 4px;
}

.el-menu-vertical-demo .el-menu--inline .el-menu-item {
  height: 44px;
  line-height: 44px;
  min-width: auto;
}

/* 子菜单项不需要图标，缩进由 Element 自带的内边距控制 */
.el-menu-vertical-demo .el-menu--inline .el-menu-item.is-active {
  background-color: #eef6ea;
  color: #2e7d32;
}

/* 统一滚动条外观，避免默认灰色粗条破坏整体质感 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  background: #c9d3c4;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #b0bda9;
}

::-webkit-scrollbar-track {
  background: transparent;
}
/* ===== 登录页 ===== */
.login-wrapper {
  /* 登录页外围保持纯白，突出中间登录卡片和背景图，不再使用浅绿色底色。 */
  background: #ffffff;
  display: flex;
  width: 100vw;
  height: 100vh;
  margin: auto;
}

.login-container {
  background-color: #fff;
  position: relative;
  width: 1000px;
  height: 600px;
  margin: auto;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 24px 60px rgba(31, 61, 28, 0.16),
    0 4px 14px rgba(31, 61, 28, 0.07);
}

.switch-wrapper {
  position: absolute;
  z-index: 99;
  left: 0;
  overflow: hidden;
  width: 32%;
  height: 100%;
  background-color: #234c25;
  transition: transform 1s ease-in-out;
}

/* 背景图使用整张登录卡片的尺寸：切换时面板移动，图片同步从左景滑到右景。 */
.switch-wrapper::before {
  content: '';
  position: absolute;
  z-index: 0;
  inset: 0;
  background-image: url('./assets/login/login-bg.jpg');
  background-repeat: no-repeat;
  background-size: 1000px 600px;
  background-position: top left;
  transform: scale(1.01);
  transition: background-position 1s ease-in-out;
}

/* 保留轻量绿色遮罩，既能看清矿山背景，也保证品牌文字的对比度。 */
.switch-wrapper::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    160deg,
    rgba(21, 53, 24, 0.68) 0%,
    rgba(37, 82, 34, 0.48) 48%,
    rgba(20, 48, 23, 0.70) 100%
  );
}

.active .switch-wrapper {
  transform: translateX(calc(1000px - 100%));
}

.active .switch-wrapper::before {
  background-position: top right;
}

/* 左侧品牌信息 */
.brand-panel {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 44px 30px 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
  color: #ffffff;
}

.brand-mark {
  font-size: 11px;
  letter-spacing: 3px;
  color: rgba(255, 255, 255, 0.62);
  margin-bottom: 14px;
}

.brand-title {
  font-size: 25px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: 1px;
  color: #ffffff;
}

.brand-divider {
  width: 34px;
  height: 2px;
  background: rgba(255, 255, 255, 0.75);
  margin: 18px 0 14px;
  border-radius: 1px;
}

.brand-desc {
  font-size: 12px;
  line-height: 1.85;
  color: rgba(255, 255, 255, 0.72);
}

.txt {
  width: 100%;
  height: 100%;
  transition: all 1s ease-in-out;
}

.top-wrapper {
  position: absolute;
  width: 260px;
  height: 168px;
  top: 50px;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 10px;
  border-radius: 5px;
}

/* 去注册 / 去登录：底部胶囊按钮，去掉原来的蓝色实心 */
.btn-wrapper {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  width: 112px;
  height: 38px;
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.55);
  font-size: 14px;
  border-radius: 19px;
  cursor: pointer;
  flex-wrap: wrap;
  overflow: hidden;
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.24);
}

.outerBox {
  position: absolute;
  z-index: 3;
  left: 32%;
  overflow: hidden;
  width: 68%;
  height: 100%;
  transition: all 1s ease-in-out;
}

.container {
  width: 100%;
  height: 100%;
  background-color: #ffffff;
}

.active .outerBox {
  transform: translateX(calc(-1000px + 100%));
}

.ld {
  width: 200px;
  height: 40px;
  position: absolute;
  right: 16px;
  top: 16px;
}

/* 表单区宽度：原来靠内容自适应，显得窄而散 */
.login,
.register {
  width: 336px;
  max-width: 82%;
}

.register {
  width: 360px;
}

.register .el-form-item {
  margin-bottom: 14px;
}

.register-role-tip {
  margin: -4px 0 12px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7a8f;
  background: #f5f8fb;
  border: 1px solid #e3ebf3;
  border-radius: 6px;
}

.register-role-tip i {
  margin-right: 4px;
  color: #7f9ab5;
}

.title {
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.5px;
  line-height: 1.4;
  text-align: left;
  margin-bottom: 6px;
  color: #1f3d1c;
}

.title-sub {
  font-size: 13px;
  color: #8d9a86;
  margin: 0 0 26px;
  text-align: left;
  line-height: 1.6;
}

/* 输入框：加高、圆角、聚焦时绿色描边 */
.login-wrapper .el-input__inner {
  height: 44px;
  line-height: 44px;
  border-radius: 8px;
  border-color: #dfe6da;
  background-color: #fbfdfa;
  font-size: 14px;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}

.login-wrapper .el-input__inner:focus {
  border-color: #6aa84f;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(106, 168, 79, 0.12);
}

.login-wrapper .el-input__prefix {
  color: #a9b6a2;
}

.login-wrapper .el-form-item {
  margin-bottom: 20px;
}

/* 主按钮：绿色实心，和系统主题一致 */
.btn-login {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  letter-spacing: 2px;
  background-color: #2e7d32;
  border-color: #2e7d32;
  transition: background-color 0.15s, box-shadow 0.15s;
}

.btn-login:hover,
.btn-login:focus {
  background-color: #256428;
  border-color: #256428;
  box-shadow: 0 6px 16px rgba(46, 125, 50, 0.24);
}

.row {
  display: flex;
  display: -webkit-flex;
  flex-direction: row;
}
.column {
  display: flex;
  display: -webkit-flex;
  flex-direction: column;
}
.aCenter {
  align-items: center;
}
.jCenter {
  justify-content: center;
}
</style>
