<template>
  <view>
    <!-- 搜索区域卡片 -->
    <view class="vk-page-card vk-page-search-card">
      <vk-data-table-query
        v-model="queryForm1.formData"
        :columns="queryForm1.columns"
        :span="3"
        :collapse-rows="1"
        :collapse-default-expand="true"
        @search="search"
        @collapse-change="collapseChange"
      ></vk-data-table-query>
    </view>
    <!-- 表格内容卡片 -->
    <view class="vk-page-card">
      <!-- 操作按钮与表格标题区域 -->
      <view class="vk-page-card-toolbar">
        <!-- 左侧标题 -->
        <view class="vk-page-card-title">语言列表</view>
        <!-- 右侧操作栏 -->
        <view class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addBtn">添加语言</el-button>
        </view>
      </view>

      <!-- 表格区域 -->
      <view class="vk-page-card-table">
        <!-- 表格组件开始 -->
        <vk-data-table
          ref="table1"
          :action="table1.action"
          :columns="table1.columns"
          :query-form-param="queryForm1"
          :right-btns="['update', 'delete']"
          :row-no="true"
          :pagination="true"
          @update="updateBtn"
          @delete="deleteBtn"
        >
          <!-- 是否默认 -->
          <template v-slot:is_default="{ row }">
            <el-tag v-if="row.is_default" type="success" size="mini">默认</el-tag>
            <el-tag v-else type="info" size="mini">否</el-tag>
          </template>
        </vk-data-table>
        <!-- 表格组件结束 -->
      </view>
    </view>
    <!-- 添加或编辑的弹窗开始 -->
    <vk-data-dialog v-model="formDatas.i18nForm.show" :title="formDatas.i18nForm.title" width="500px" mode="form" :close-on-click-modal="false">
      <vk-data-form
        v-model="formDatas.i18nForm.item"
        :rules="form1.rules"
        :action="formDatas.i18nForm.action"
        :form-type="formDatas.i18nForm.formType"
        :columns="form1.columns"
        label-width="120px"
        @success="formSuccess"
      ></vk-data-form>
    </vk-data-dialog>
    <!-- 添加或编辑的弹窗结束 -->

    <!-- 页面内容结束 -->
  </view>
</template>

<script>
  let vk = uni.vk; // vk实例
  const SERVICE_URL = 'client/setting/i18n'; // 语言管理云函数目录

  export default {
    data() {
      // 页面数据变量
      return {
        // 页面是否请求中或加载中
        loading: false,
        // init请求返回的数据
        data: {},
        // 表格相关开始 -----------------------------------------------------------
        table1: {
          // 表格数据请求地址
          action: SERVICE_URL + '/getList',
          // 表格字段显示规则
          columns: [
            { key: 'name', title: '显示名称', type: 'text', width: 160 },
            { key: 'locale', title: '语言', type: 'text', width: 160 },
            { key: 'is_default', title: '是否默认', type: 'text', width: 100 },
            { key: '_add_time', title: '添加时间', type: 'time', width: 160, sortable: 'custom' },
          ],
        },
        // 表格相关结束 -----------------------------------------------------------
        // 表单相关开始 -----------------------------------------------------------
        // 查询表单请求数据
        queryForm1: {
          // 查询表单数据源，可在此设置默认值
          formData: {},
          // 查询表单的字段规则 fieldName:指定数据库字段名,不填默认等于key
          columns: [
            { key: 'name', title: '显示名称', type: 'text', width: 160, mode: '%%' },
            { key: 'locale', title: '语言', type: 'text', width: 160, mode: '%%' },
          ],
        },
        // 表单静态配置（字段规则与校验规则）
        form1: {
          columns: [
            { key: 'name', title: '显示名称', type: 'text', placeholder: '如：简体中文' },
            { key: 'locale', title: '语言', type: 'text', placeholder: '如：zh-Hans' },
            { key: 'is_default', title: '是否默认', type: 'switch', defaultValue: false },
          ],
          rules: {
            name: [
              { required: true, message: '请输入显示名称', trigger: 'blur' },
              { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' },
            ],
            locale: [
              { required: true, message: '请输入语言', trigger: 'blur' },
              { pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/, message: '仅允许字母、数字和中划线，如 zh-Hans', trigger: 'blur' },
            ],
          },
        },
        // 弹窗表单数据，通过 vk.pubfn.openForm 打开
        formDatas: {
          i18nForm: { show: false, title: '', formType: 'add', action: '', item: {} },
        },
        // 表单相关结束 -----------------------------------------------------------
      };
    },
    // 监听 - 页面每次【加载时】执行(如：前进)
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
    },
    // 监听 - 页面【首次渲染完成时】执行。注意如果渲染速度快，会在页面进入动画完成前触发
    onReady() {},
    // 监听 - 页面每次【显示时】执行(如：前进和返回) (页面每次出现在屏幕上都触发，包括从下级页面点返回露出当前页面)
    onShow() {},
    // 监听 - 页面每次【隐藏时】执行(如：返回)
    onHide() {},
    // 函数
    methods: {
      // 页面跳转
      pageTo(path) {
        vk.navigateTo(path);
      },
      // 搜索
      search() {
        this.$refs.table1.search();
      },
      // 监听 - 查询表单折叠面板变化事件
      collapseChange() {
        this.$refs.table1.doLayout();
      },
      // 刷新
      refresh() {
        this.$refs.table1.refresh();
      },
      // 显示添加弹窗
      addBtn() {
        vk.pubfn.openForm('i18nForm', { title: '添加语言', formType: 'add', action: SERVICE_URL + '/add', item: { is_default: false } }, this);
      },
      // 显示修改弹窗
      updateBtn({ item }) {
        vk.pubfn.openForm('i18nForm', { title: '编辑语言', formType: 'update', action: SERVICE_URL + '/update', item }, this);
      },
      // 表单提交成功
      formSuccess() {
        vk.pubfn.closeForm('i18nForm', this);
        this.refresh();
      },
      // 删除按钮
      deleteBtn({ item, deleteFn }) {
        deleteFn({
          action: SERVICE_URL + '/delete',
          data: {
            _id: item._id,
          },
        });
      },
    },
    // 监听属性
    watch: {},
    // 计算属性
    computed: {},
  };
</script>
<style lang="scss" scoped>
  page {
    background-color: #f5f5f5;
  }
</style>
