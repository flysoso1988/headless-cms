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
        <view class="vk-page-card-title">设计列表</view>
        <!-- 右侧操作栏 -->
        <view class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addBtn">添加设计</el-button>
          <el-dropdown v-if="table1.multipleSelection" :split-button="false" trigger="click" @command="batchBtn">
            <el-button type="danger" :size="$global.size" style="margin-left: 20rpx" :disabled="table1.multipleSelection.length === 0">
              批量操作<i class="el-icon-arrow-down el-icon--right"></i>
            </el-button>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item :command="1">批量删除</el-dropdown-item>
              <el-dropdown-item :command="2">批量导出</el-dropdown-item>
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
          <!-- 排序值 -->
          <template v-slot:sort="{ row, column, index }">
            <el-input v-model="row.sort" size="mini" @change="sortChange($event, row)" />
          </template>
        </vk-data-table>
        <!-- 表格组件结束 -->
      </view>
    </view>
    <!-- 页面内容结束 -->
  </view>
</template>

<script>
  let vk = uni.vk; // vk实例

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
          action: 'admin/design/sys/getList',
          // 表格字段显示规则
          columns: [
            { key: '_id', title: 'ID', type: 'text', width: 220 },
            { key: 'name', title: '设计名称', type: 'text', width: 150 },
            { key: 'type', title: '设计类型', type: 'text', width: 100 },
            { key: 'status', title: '状态', type: 'text', width: 80 },
            { key: '_add_time', title: '添加时间', type: 'time', width: 160, sortable: 'custom' },
            { key: '_add_time', title: '距离现在', type: 'dateDiff', width: 120 },
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
            { key: 'name', title: '设计名称', type: 'text', width: 160, mode: '%%' },
            { key: 'type', title: '设计类型', type: 'text', width: 160, mode: '%%' },
            { key: '_add_time', title: '添加时间', type: 'datetimerange', width: 400, mode: '[]' },
          ],
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
      init(options) {},
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
        vk.navigateTo('/pages/design/edit');
      },
      // 显示修改页面
      updateBtn({ item }) {
        vk.navigateTo('/pages/design/edit?id=' + item._id);
      },
      // 删除按钮
      deleteBtn({ item, deleteFn }) {
        deleteFn({
          action: 'admin/design/sys/delete',
          data: {
            _id: item._id,
          },
        });
      },
      // 监听 - 批量操作的按钮点击事件
      batchBtn(index) {
        switch (index) {
          case 1:
            vk.toast('批量删除');
            break;
          case 2:
            vk.toast('批量导出');
            break;
          default:
            break;
        }
      },
      sortChange(sort, item) {
        vk.callFunction({
          url: 'admin/design/sys/updateSort',
          data: {
            _id: item._id,
            sort: Number(sort),
          },
          success: (data) => {},
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
