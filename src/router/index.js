import Vue from "vue";
import Router from "vue-router";
import kuangqv from "../components/kuangqv";
import Evaluate from "../components/Evaluate";
import Coverage from "../components/Coverage";
import Administrator from "../components/Administrator";
import RSEI from "../components/RSEI";
import vri from "../components/vri";
import ndsi from "../components/ndsi";
import ndmi from "../components/ndmi";
import ThematicMap from "../components/ThematicMap";
import Dashboard from "../components/Dashboard";
import EvaluationAudit from "../components/EvaluationAudit";


// 调用Vue.use() 函数，把VueRouter 安装为Vue的插件
Vue.use(Router);

// 向外共享路由的新建路由的实例对象
export default new Router({
  routes: [
    {
      path: "/Dashboard",
      name: "Dashboard",
      component: Dashboard
    },
    {
      path: "/kuangqv",
      name: "kuangqv",
      component: kuangqv
    },
    {
      path: "/Audit",
      name: "Audit",
      component: EvaluationAudit
    },
    {
      path: "/Evaluate",
      name: "Evaluate",
      component: Evaluate
    },
    {
      path: "/Coverage",
      name: "Coverage",
      component: Coverage
    },
    {
      path: "/vri",
      name: "vri",
      component: vri
    },
    {
      path: "/ndsi",
      name: "ndsi",
      component: ndsi
    },
    {
      path: "/ndmi",
      name: "ndmi",
      component: ndmi
    },
    {
      path: "/Administrator",
      name: "Administrator",
      component: Administrator
    },
    {
      path: "/RSEI",
      name: "RSEI",
      component: RSEI
    },
    {
      path: "/ThematicMap",
      name: "ThematicMap",
      component: ThematicMap
    },

  ]
});
