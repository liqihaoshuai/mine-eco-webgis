<template>
  <div class="user-management">
    <div class="page-heading">
      <div>
        <h2>用户管理</h2>
        <p>统一管理系统账号、角色和访问状态</p>
      </div>
      <el-button type="primary" icon="el-icon-plus" @click="openAddDialog">添加用户</el-button>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <span class="summary-icon is-blue"><i class="el-icon-user"></i></span>
        <div><span class="summary-label">用户总数</span><strong>{{ users.length }}</strong></div>
      </div>
      <div class="summary-card">
        <span class="summary-icon is-green"><i class="el-icon-s-custom"></i></span>
        <div><span class="summary-label">管理员</span><strong>{{ adminCount }}</strong></div>
      </div>
      <div class="summary-card">
        <span class="summary-icon is-orange"><i class="el-icon-user-solid"></i></span>
        <div><span class="summary-label">普通用户</span><strong>{{ userCount }}</strong></div>
      </div>
      <div class="summary-card">
        <span class="summary-icon is-teal"><i class="el-icon-circle-check"></i></span>
        <div><span class="summary-label">正常账号</span><strong>{{ activeCount }}</strong></div>
      </div>
    </div>

    <div class="toolbar-card">
      <el-input
        v-model="keyword"
        clearable
        prefix-icon="el-icon-search"
        placeholder="搜索姓名、账号、邮箱或手机号"
        class="search-input"
      ></el-input>
      <el-select v-model="roleFilter" clearable placeholder="全部角色" class="filter-select">
        <el-option label="管理员" value="admin"></el-option>
        <el-option label="普通用户" value="user"></el-option>
      </el-select>
      <el-select v-model="statusFilter" clearable placeholder="全部状态" class="filter-select">
        <el-option label="正常" value="active"></el-option>
        <el-option label="已停用" value="disabled"></el-option>
      </el-select>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <div class="table-card">
      <el-table :data="filteredUsers" stripe class="user-table" empty-text="暂无匹配用户">
        <el-table-column prop="displayName" label="用户信息" min-width="180">
          <template slot-scope="scope">
            <div class="user-cell">
              <span class="avatar">{{ avatarText(scope.row) }}</span>
              <div><strong>{{ scope.row.displayName || scope.row.username }}</strong><small>{{ scope.row.username }}</small></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户类型" width="120">
          <template slot-scope="scope"><el-tag :type="scope.row.role === 'admin' ? 'success' : 'info'" size="small">{{ roleLabel(scope.row.role) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="190"></el-table-column>
        <el-table-column prop="mobile" label="手机号" min-width="130"></el-table-column>
        <el-table-column label="状态" width="100">
          <template slot-scope="scope"><span :class="['status-dot', scope.row.status === 'active' ? 'is-active' : 'is-disabled']">{{ statusLabel(scope.row.status) }}</span></template>
        </el-table-column>
        <el-table-column label="最近登录" min-width="160">
          <template slot-scope="scope">{{ formatUserTime(scope.row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button
              v-if="scope.row.role !== 'admin'"
              type="text"
              size="small"
              @click="toggleStatus(scope.row)"
            >{{ scope.row.status === 'active' ? '停用' : '启用' }}</el-button>
            <el-button type="text" size="small" class="danger-text" @click="removeUser(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      :title="editingId ? '编辑用户' : '添加用户'"
      :visible.sync="dialogVisible"
      width="480px"
      append-to-body
      custom-class="user-dialog"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="userForm" :model="form" :rules="rules" label-width="82px">
        <el-form-item label="姓名" prop="displayName"><el-input v-model="form.displayName" placeholder="请输入姓名"></el-input></el-form-item>
        <el-form-item label="账号" prop="username"><el-input v-model="form.username" :disabled="!!editingId" placeholder="请输入登录账号"></el-input></el-form-item>
        <el-form-item label="邮箱" prop="email"><el-input v-model="form.email" placeholder="请输入邮箱"></el-input></el-form-item>
        <el-form-item label="手机号" prop="mobile"><el-input v-model="form.mobile" placeholder="请输入手机号"></el-input></el-form-item>
        <el-form-item label="用户类型" prop="role"><el-select v-model="form.role" style="width:100%"><el-option label="普通用户" value="user"></el-option><el-option label="管理员" value="admin"></el-option></el-select></el-form-item>
        <el-form-item label="密码" prop="password"><el-input v-model="form.password" type="password" show-password :placeholder="editingId ? '不修改请留空' : '请输入至少6位密码'"></el-input></el-form-item>
      </el-form>
      <div slot="footer"><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="saveUser">保存</el-button></div>
    </el-dialog>
  </div>
</template>

<script>
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  roleLabel,
  statusLabel,
  formatUserTime
} from '../assets/userStore.js';

export default {
  name: 'Administrator',
  data() {
    return {
      users: getUsers(),
      keyword: '',
      roleFilter: '',
      statusFilter: '',
      dialogVisible: false,
      editingId: '',
      form: this.emptyForm(),
      rules: {
        displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
        username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
        email: [{ required: true, type: 'email', message: '请输入正确邮箱', trigger: 'blur' }],
        mobile: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
        role: [{ required: true, message: '请选择用户类型', trigger: 'change' }],
        password: [{ validator: (rule, value, callback) => { if (!this.editingId && (!value || value.length < 6)) callback(new Error('密码至少6位')); else callback(); }, trigger: 'blur' }]
      }
    };
  },
  computed: {
    filteredUsers() {
      const text = this.keyword.trim().toLowerCase();
      return this.users.filter(user => {
        const content = [user.displayName, user.username, user.email, user.mobile].filter(Boolean).join(' ').toLowerCase();
        return (!text || content.indexOf(text) >= 0) && (!this.roleFilter || user.role === this.roleFilter) && (!this.statusFilter || user.status === this.statusFilter);
      });
    },
    adminCount() { return this.users.filter(user => user.role === 'admin').length; },
    userCount() { return this.users.filter(user => user.role === 'user').length; },
    activeCount() { return this.users.filter(user => user.status === 'active').length; }
  },
  methods: {
    emptyForm() { return { displayName: '', username: '', email: '', mobile: '', role: 'user', password: '' }; },
    reloadUsers() { this.users = getUsers(); },
    roleLabel,
    statusLabel,
    formatUserTime,
    avatarText(user) { return (user.displayName || user.username || '用').slice(0, 1); },
    resetFilters() { this.keyword = ''; this.roleFilter = ''; this.statusFilter = ''; },
    openAddDialog() { this.editingId = ''; this.form = this.emptyForm(); this.dialogVisible = true; },
    openEditDialog(row) { this.editingId = row.id; this.form = { ...row, password: '' }; this.dialogVisible = true; },
    resetForm() { this.editingId = ''; this.form = this.emptyForm(); if (this.$refs.userForm) this.$refs.userForm.resetFields(); },
    saveUser() {
      this.$refs.userForm.validate(valid => {
        if (!valid) return;
        const result = this.editingId
          ? updateUser(this.editingId, this.form)
          : createUser(this.form);
        if (!result.ok) { this.$message.error(result.message); return; }
        this.reloadUsers();
        this.dialogVisible = false;
        this.$message.success('用户信息已保存');
      });
    },
    toggleStatus(row) {
      // 管理员账号不提供停用入口，这里再兜一层，避免绕过界面直接调用。
      if (row.role === 'admin') {
        this.$message.warning('管理员账号不支持停用');
        return;
      }
      const result = updateUser(row.id, { status: row.status === 'active' ? 'disabled' : 'active' });
      if (!result.ok) { this.$message.error(result.message); return; }
      this.reloadUsers();
      this.$message.success(result.user.status === 'active' ? '账号已启用' : '账号已停用');
    },
    removeUser(row) {
      this.$confirm(`确定删除账号“${row.username}”吗？删除后不可恢复。`, '删除确认', { type: 'warning' }).then(() => {
        const result = deleteUser(row.id);
        if (!result.ok) { this.$message.error(result.message); return; }
        this.reloadUsers();
        this.$message.success('用户已删除');
      }).catch(() => {});
    }
  }
};
</script>

<style scoped>
.user-management { min-height: 100%; padding: 26px 30px 36px; box-sizing: border-box; background: #f7f9fb; color: #2f3542; }
.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.eyebrow { color: #8a98aa; font-size: 11px; letter-spacing: 1.8px; margin-bottom: 5px; }
.page-heading h2 { margin: 0; color: #263445; font-size: 24px; font-weight: 600; }
.page-heading p { margin: 7px 0 0; color: #8793a2; font-size: 13px; }
.page-heading .el-button { height: 36px; border-radius: 6px; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
.summary-card { display: flex; align-items: center; gap: 12px; min-height: 84px; padding: 15px 17px; box-sizing: border-box; border: 1px solid #e7ecf2; border-radius: 8px; background: #fff; box-shadow: 0 3px 12px rgba(44, 62, 80, .04); }
.summary-icon { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 9px; font-size: 18px; }
.summary-icon.is-blue { color: #378add; background: #eaf4ff; }.summary-icon.is-green { color: #3b9b68; background: #eaf8f0; }.summary-icon.is-orange { color: #d88932; background: #fff4e5; }.summary-icon.is-teal { color: #1d9a9a; background: #e7f8f7; }
.summary-label { display: block; color: #8a96a6; font-size: 12px; margin-bottom: 6px; }.summary-card strong { color: #263445; font-size: 22px; font-weight: 600; }
.toolbar-card { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px solid #e7ecf2; border-radius: 8px 8px 0 0; background: #fff; }.search-input { width: 300px; }.filter-select { width: 130px; }.toolbar-card .el-button { height: 32px; }
.table-card { border: 1px solid #e7ecf2; border-top: 0; border-radius: 0 0 8px 8px; background: #fff; overflow: hidden; }.user-table { width: 100%; }.user-cell { display: flex; align-items: center; gap: 9px; }.user-cell strong, .user-cell small { display: block; }.user-cell strong { color: #344255; font-size: 13px; }.user-cell small { color: #9aa5b2; font-size: 11px; margin-top: 3px; }.avatar { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; color: #fff; background: #378add; font-size: 13px; }
.status-dot { position: relative; padding-left: 14px; font-size: 12px; }.status-dot::before { content: ''; position: absolute; left: 0; top: 5px; width: 7px; height: 7px; border-radius: 50%; background: #3b9b68; }.status-dot.is-disabled { color: #a0a8b2; }.status-dot.is-disabled::before { background: #b7bec7; }.danger-text { color: #e25c5c; }
.user-management >>> .el-table th { color: #6e7d90; font-weight: 600; background: #f8fafc; }.user-management >>> .el-table td { color: #566476; font-size: 12px; }.user-management >>> .el-table--striped .el-table__body tr.el-table__row--striped td { background: #fcfdfe; }.user-management >>> .el-input__inner, .user-management >>> .el-select .el-input__inner { border-radius: 5px; }
@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.toolbar-card { flex-wrap: wrap; }.search-input { width: 100%; } }
</style>

<style>
/* 弹窗使用 append-to-body 后会挂到 body 下，脱离 scoped 作用域，
   这里用 custom-class 统一约束样式，避免弹窗尺寸与标题样式丢失。 */
.user-dialog { border-radius: 8px; }
.user-dialog .el-dialog__header { border-bottom: 1px solid #edf0f4; }
.user-dialog .el-dialog__title { color: #2f3e50; font-size: 16px; }
.user-dialog .el-dialog__body { padding: 22px 24px 8px; }
.user-dialog .el-input__inner,
.user-dialog .el-select .el-input__inner { border-radius: 5px; }
</style>
