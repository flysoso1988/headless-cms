<template>
  <view>
    <!-- 表格内容卡片 -->
    <view class="vk-page-card">
      <!-- 操作按钮与表格标题区域 -->
      <view class="vk-page-card-toolbar">
        <!-- 左侧标题 -->
        <view class="vk-page-card-title">API 令牌</view>
        <!-- 右侧操作栏 -->
        <view class="vk-page-card-actions">
          <el-button type="primary" :size="$global.size" icon="el-icon-plus" @click="addBtn">添加</el-button>
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
          :custom-right-btns="table1.customRightBtns"
          right-btns-align="right"
          :selection="true"
          :row-no="true"
          :pagination="true"
          @current-change="currentChange"
          @selection-change="selectionChange"
        ></vk-data-table>
        <!-- 表格组件结束 -->
      </view>
    </view>
    <!-- 添加或编辑的弹窗开始 -->
    <vk-data-dialog v-model="form1.props.show" :title="form1.props.title" width="600px" mode="form" :close-on-click-modal="false">
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
          action: 'admin/setting/sys.apiToken.getList',
          // 表格字段显示规则
          columns: [
            { key: 'name', title: '名称', type: 'text' },
            { key: 'description', title: '描述', type: 'text' },
            { key: '_add_time', title: '添加时间', type: 'time', width: 160, sortable: 'custom' },
          ],
          // 多选框选中的值
          multipleSelection: [],
          // 当前高亮的记录
          selectItem: '',
          // 右侧固定按钮
          customRightBtns: [
            {
              title: '编辑',
              type: 'primary',
              icon: 'el-icon-edit',
              onClick: (item) => {
                this.updateBtn({ item: vk.pubfn.copyObject(item) });
              },
            },
            {
              title: '删除',
              type: 'danger',
              icon: 'el-icon-delete',
              onClick: (item) => {
                this.deleteBtn(item);
              },
            },
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
            { key: 'name', title: '名称', type: 'text', width: 160, mode: '%%' },
            { key: '_add_time', title: '添加时间', type: 'datetimerange', width: 400, mode: '[]' },
          ],
        },
        form1: {
          // 表单请求数据，此处可以设置默认值
          data: {
            token_duration: 0,
            token_type: 'read-only',
            model_permissions: [],
          },
          // 表单属性
          props: {
            // 表单请求地址
            action: '',
            // 表单字段显示规则
            columns: [
              { key: 'name', title: '名称', type: 'text', placeholder: '请输入令牌名称' },
              { key: 'description', title: '描述', type: 'textarea', placeholder: '请输入令牌用途描述' },
              {
                key: 'token_duration',
                title: '有效期',
                type: 'select',
                data: [
                  { value: 0, label: '永久有效' },
                  { value: 7, label: '7 天' },
                  { value: 30, label: '30 天' },
                  { value: 90, label: '90 天' },
                  { value: 180, label: '180 天' },
                  { value: 365, label: '365 天' },
                ],
                defaultValue: 0,
              },
              {
                key: 'token_type',
                title: '令牌类型',
                type: 'select',
                data: [
                  { value: 'read-only', label: '只读（仅可读取）' },
                  { value: 'full-access', label: '完全访问（可读写全部模型）' },
                  { value: 'custom', label: '自定义（按模型权限）' },
                ],
                defaultValue: 'read-only',
              },
              {
                key: 'model_permissions',
                title: '模型权限',
                type: 'remote-select',
                placeholder: '请选择该令牌可访问的模型',
                action: 'admin/setting/sys.apiToken.getModels',
                props: { list: 'list', value: 'key', label: 'name' },
                multiple: true,
                showAll: true,
                showRule: 'token_type=custom',
              },
            ],
            rules: {
              name: [
                { required: true, message: '请输入名称', trigger: 'blur' },
                { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' },
              ],
              token_type: [{ required: true, message: '请选择令牌类型', trigger: 'change' }],
              token_duration: [{ required: true, message: '请选择有效期', trigger: 'change' }],
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
        this.form1.props.action = 'admin/setting/sys.apiToken.add';
        this.form1.props.formType = 'add';
        this.form1.props.title = '添加 API 令牌';
        this.form1.props.show = true;
      },
      // 显示修改页面
      updateBtn({ item }) {
        this.form1.props.action = 'admin/setting/sys.apiToken.update';
        this.form1.props.formType = 'update';
        this.form1.props.title = '编辑 API 令牌';
        this.form1.props.show = true;
        this.form1.data = item;
      },
      // 删除按钮
      deleteBtn(item) {
        this.$confirm(`删除令牌【${item.name}】后，使用该令牌的调用将立即失效，是否继续？`, '删除确认', {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'warning',
        })
          .then(() => {
            vk.callFunction({
              url: 'admin/setting/sys.apiToken.delete',
              data: { _id: item._id },
              success: () => {
                vk.toast('删除成功');
                this.refresh();
              },
            });
          })
          .catch(() => {});
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
