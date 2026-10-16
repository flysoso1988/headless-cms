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
        <view class="vk-page-card-title">列表</view>
        <!-- 右侧操作栏 -->
        <view class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addBtn">添加</el-button>
          <el-dropdown v-if="table1.multipleSelection" :split-button="false" trigger="click" @command="batchBtn">
            <el-button type="danger" :size="$global.size" style="margin-left: 20rpx" :disabled="table1.multipleSelection.length === 0">
              批量操作<i class="el-icon-arrow-down el-icon--right"></i>
            </el-button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item :command="1">批量操作1</el-dropdown-item>
              <el-dropdown-item :command="2">批量操作2</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
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
          :right-btns="['detail_auto', 'update', 'delete']"
          :selection="true"
          :row-no="true"
          :pagination="true"
          @update="updateBtn"
          @delete="deleteBtn"
          @current-change="currentChange"
          @selection-change="selectionChange"
        >
        </vk-data-table>
        <!-- 表格组件结束 -->
      </view>
    </view>
    <!-- 添加或编辑的弹窗开始 -->
    <vk-data-dialog v-model="form1.props.show" :title="form1.props.title" width="500px" mode="form" :close-on-click-modal="false">
      <vk-data-form
        v-model="form1.data"
        :rules="form1.props.rules"
        :action="form1.props.action"
        :form-type="form1.props.formType"
        :columns="form1.props.columns"
        label-width="120px"
        @success="
          form1.props.show = false;
          refresh();
        "
      ></vk-data-form>
    </vk-data-dialog>
    <!-- 添加或编辑的弹窗结束 -->

    <!-- 页面内容结束 -->
  </view>
</template>

<script>
  let vk = uni.vk; // vk实例
  let originalForms = {}; // 表单初始化数据

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
          action: 'admin/setting/sys.i18n.getList',
          // 表格字段显示规则
          columns: [
            { key: 'name', title: '显示名称', type: 'text' },
            { key: 'locale', title: '语言', type: 'text' },
            { key: 'is_default', title: '是否默认', type: 'switch' },
            { key: 'sort', title: '排序', type: 'number', width: 80 },
          ],
          // 多选框选中的值
          multipleSelection: [],
          // 当前高亮的记录
          selectItem: '',
        },
        // 表格相关结束 -----------------------------------------------------------
        // 表单相关开始 -----------------------------------------------------------
        // 查询表单请求数据
        queryForm1: {
          // 查询表单数据源，可在此设置默认值
          formData: {},
          // 查询表单的字段规则 fieldName:指定数据库字段名,不填默认等于key
          columns: [
            { key: 'remark', title: '备注', type: 'text', width: 160, mode: '%%' },
            { key: '_add_time', title: '添加时间', type: 'datetimerange', width: 400, mode: '[]' },
          ],
        },
        form1: {
          // 表单请求数据，此处可以设置默认值
          data: {},
          // 表单属性
          props: {
            // 表单请求地址
            action: '',
            // 表单字段显示规则
            columns: [
              { key: 'name', title: '显示名称', type: 'text', placeholder: '如：简体中文' },
              { key: 'locale', title: '语言', type: 'text', placeholder: '如：zh-Hans' },
              { key: 'is_default', title: '是否默认', type: 'switch', defaultValue: false },
              { key: 'sort', title: '排序', type: 'number', defaultValue: 1000, tip: '数值越小越靠前' },
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
              sort: [{ type: 'number', message: '排序必须是数字', trigger: 'blur' }],
            },
            // add 代表添加 update 代表修改
            formType: '',
            // 是否显示表单的弹窗
            show: false,
          },
        },
        // 其他弹窗表单
        formDatas: {},
        // 表单相关结束 -----------------------------------------------------------
      };
    },
    // 监听 - 页面每次【加载时】执行(如：前进)
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    // 监听 - 页面【首次渲染完成时】执行。注意如果渲染速度快，会在页面进入动画完成前触发
    onReady() {},
    // 监听 - 页面每次【显示时】执行(如：前进和返回) (页面每次出现在屏幕上都触发，包括从下级页面点返回露出当前页面)
    onShow() {},
    // 监听 - 页面每次【隐藏时】执行(如：返回)
    onHide() {},
    // 函数
    methods: {
      // 页面数据初始化函数
      init(options) {
        originalForms['form1'] = vk.pubfn.copyObject(this.form1);
      },
      // 页面跳转
      pageTo(path) {
        vk.navigateTo(path);
      },
      // 表单重置
      resetForm() {
        vk.pubfn.resetForm(originalForms, this);
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
      // 获取当前选中的行的数据
      getCurrentRow() {
        return this.$refs.table1.getCurrentRow();
      },
      // 监听 - 行的选中高亮事件
      currentChange(val) {
        this.table1.selectItem = val;
      },
      // 当选择项发生变化时会触发该事件
      selectionChange(list) {
        this.table1.multipleSelection = list;
      },
      // 显示添加页面
      addBtn() {
        this.resetForm();
        this.form1.props.action = 'admin/setting/sys.i18n.add';
        this.form1.props.formType = 'add';
        this.form1.props.title = '添加';
        this.form1.props.show = true;
      },
      // 显示修改页面
      updateBtn({ item }) {
        this.form1.props.action = 'admin/setting/sys.i18n.update';
        this.form1.props.formType = 'update';
        this.form1.props.title = '编辑';
        this.form1.props.show = true;
        this.form1.data = item;
      },
      // 删除按钮
      deleteBtn({ item, deleteFn }) {
        deleteFn({
          action: 'admin/setting/sys.i18n.delete',
          data: {
            _id: item._id,
          },
        });
      },
      // 监听 - 批量操作的按钮点击事件
      batchBtn(index) {
        switch (index) {
          case 1:
            vk.toast('批量操作按钮1');
            break;
          case 2:
            vk.toast('批量操作按钮2');
            break;
          default:
            break;
        }
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
