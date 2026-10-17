<template>
  <vk-data-dialog
    v-model="value.show"
    :title="page.title"
    :top="page.top"
    :width="page.width"
    :close-on-click-modal="true"
    :destroy-on-close="true"
    mode="form"
    @open="onOpen"
    @closed="onClose"
  >
    <vk-data-form
      ref="form1"
      v-model="form1.data"
      :form-type="value.mode"
      :rules="form1.props.rules"
      :action="form1.props.action"
      :before-action="beforeAction"
      :columns="form1.props.columns"
      :loading.sync="form1.props.loading"
      :labelWidth="form1.props.labelWidth"
      :show-cancel="page.showCancel"
      :cancel-text="page.cancelText"
      :submit-text="page.submitText"
      @success="onFormSuccess"
    >
      <template v-slot:condition="{ form, keyName }">
        <view style="display: flex; padding-bottom: 22px">
          <div style="flex: 1">
            <el-input v-model="form[keyName].label" placeholder="请输入字段标识"></el-input>
          </div>
          <div class="line">-</div>
          <div style="flex: 1">
            <el-select v-model="form[keyName].logic" placeholder="请选择" style="width: 100%">
              <el-option label="=" value="="></el-option>
              <el-option label=">" value=">"></el-option>
              <el-option label=">=" value=">="></el-option>
              <el-option label="<" value="<"></el-option>
              <el-option label="<=" value="<="></el-option>
              <el-option label="!=" value="!="></el-option>
              <el-option label="in" value="{in}"></el-option>
              <el-option label="not in" value="{nin}"></el-option>
            </el-select>
          </div>
          <div class="line">-</div>
          <div style="flex: 1">
            <el-input v-model="form[keyName].value"></el-input>
          </div>
        </view>
      </template>
    </vk-data-form>
  </vk-data-dialog>
</template>

<script>
  let vk = uni.vk;
  let originalForms = {}; // 表单初始化数据

  export default {
    props: {
      value: {
        type: Object,
        default: () => ({
          show: false,
          mode: '',
          item: {},
          options: {},
        }),
      },
    },
    data() {
      return {
        page: {
          title: '标题',
          submitText: '确定',
          cancelText: '关闭',
          showCancel: true,
          top: '1vh',
          width: '1200px',
        },
        form1: {
          data: { fileType: 'image' },
          props: {
            action: '',
            formType: '',
            columns: [
              { key: 'title', title: '字段名称', type: 'text', placeholder: '请输入字段名称', span: 12 },
              { key: 'key', title: '字段标识', type: 'text', placeholder: '英文小写，如 title', span: 12, show: ['add'] },
              {
                key: 'type',
                title: '字段类型',
                type: 'select',
                data: [
                  { value: 'text', label: '单行文本' },
                  { value: 'textarea', label: '多行文本' },
                  { value: 'number', label: '数字' },
                  { value: 'switch', label: '开关' },
                  { value: 'radio', label: '单选' },
                  { value: 'checkbox', label: '多选' },
                  { value: 'select', label: '下拉选择' },
                  { value: 'file-select', label: '媒体选择' },
                  { value: 'date', label: '日期选择' },
                  { value: 'time', label: '时间选择' },
                  { value: 'color', label: '颜色' },
                  { value: 'editor', label: '富文本' },
                  { value: 'relation', label: '关联模型' },
                  { value: 'json', label: 'JSON' },
                  { value: 'dynamiczone', label: '动态区块' },
                  // { value: 'component', label: '组件' },
                ],
              },
              // 选择类配置
              {
                key: 'data',
                title: '选项数据',
                type: 'array<object>',
                span: 24,
                showAdd: true,
                showSort: true,
                rightBtns: ['delete'],
                columns: [
                  { key: 'label', title: '选项名', type: 'text' },
                  { key: 'value', title: '选项值', type: 'text' },
                ],
                showRule: (formData) => {
                  if (['radio', 'checkbox', 'select'].includes(formData.type)) return true;
                  return false;
                },
              },
              // 文件选择配置
              {
                key: 'fileType',
                title: '文件类型',
                type: 'radio',
                data: [
                  { value: 'image', label: '图片' },
                  { value: 'video', label: '视频' },
                  { value: 'other', label: '其他文件' },
                ],
                defaultIndex: 0,
                showRule: 'type==file-select',
              },
              { key: 'multiple', title: '是否多选', type: 'switch', showRule: 'type=file-select' },
              { key: 'multipleLimit', title: '可选数量', type: 'number', showRule: 'multiple=true' },
              // 远程选择配置
              {
                key: 'relation',
                title: '关联模型',
                type: 'remote-select',
                placeholder: '请选择关联模型',
                showRule: 'type=relation',
                action: 'admin/cms/sys.model.getList',
                props: { list: 'rows', value: '_id', label: 'name' },
                showAll: true,
                actionData: { type: 'collection' },
              },
              { key: 'default_value', title: '默认值', type: 'text', placeholder: '该字段的默认值，可留空', span: 12, showRule: (formData) => formData.type !== 'dynamiczone' },
              // 动态区块配置：允许的组件集合（来源为组件类型模型）
              {
                key: 'components',
                title: '允许的组件',
                type: 'remote-select',
                placeholder: '请选择该字段允许的组件',
                span: 24,
                showRule: 'type=dynamiczone',
                action: 'admin/cms/sys.model.getList',
                props: { list: 'rows', value: 'key', label: 'name' },
                multiple: true,
                showAll: true,
                actionData: { type: 'component' },
              },
              // 显示条件配置
              {
                key: 'condition',
                title: '显示条件',
                type: 'object',
                columns: [
                  { key: 'label', title: '', type: 'text', showLabel: false },
                  { key: 'logic', title: '', type: 'text', showLabel: false },
                  { key: 'value', title: '', type: 'text', showLabel: false },
                ],
              },
              { key: 'required', title: '是否必填', type: 'switch' },
              // { key: 'sort', title: '排序', type: 'number', defaultValue: 100, span: 12 },
            ],
            rules: {
              title: [{ required: true, message: '字段名称不能为空' }],
              key: [
                { required: true, message: '字段标识不能为空' },
                { pattern: /^[a-z_]+$/, message: '字段标识只能输入小写英文字母和下划线' },
              ],
              type: [{ required: true, message: '字段类型不能为空' }],
            },
            labelWidth: '140px',
          },
        },
      };
    },
    mounted() {
      this.init();
    },
    methods: {
      // 初始化
      init() {
        let { value } = this;
        this.$emit('input', value);
        originalForms['form1'] = vk.pubfn.copyObject(this.form1);
      },
      // 监听 - 页面打开
      onOpen() {
        let { value = {} } = this;
        let { item = {} } = value;
        // 每次打开时，重新设置表单的值 = value.item 的值，item通过 vk.pubfn.openForm('表单名',{ item:{ _id:"1" } }) 传递值
        if (value.mode === 'update') {
          this.form1.props.action = 'admin/cms/sys.field.update';
          this.page.title = '修改字段';
          this.page.submitText = '修改';
        } else {
          this.form1.props.action = 'admin/cms/sys.field.add';
          this.page.title = '添加字段';
          this.page.submitText = '添加';
        }
        console.log('form:', this.form1.data);
        console.log(item);
        this.form1.data = vk.pubfn.objectAssign(this.form1.data, item);
        // 允许的组件集合存放在字段 settings 通道（settings.components），表单上用扁平 components 编辑
        let components = item.settings && Array.isArray(item.settings.components) ? item.settings.components : [];
        this.$set(this.form1.data, 'components', components);

        console.log('form1:', this.form1.data);
      },
      // 监听 - 页面关闭
      onClose() {
        this.resetForm();
      },
      // 监听 - 提交成功后
      onFormSuccess() {
        this.value.show = false; // 关闭页面
        this.$emit('success');
      },
      // 提交前拦截：status 为系统预留字段，不允许作为模型字段
      beforeAction(formData) {
        if (formData.key === 'status') {
          vk.msg.error('字段标识 status 已被系统预留，不能使用');
          return false;
        }
        // 动态区块的允许组件集合写入字段 settings 通道（其它类型不占用 settings.components）
        if (formData.type === 'dynamiczone') {
          formData.settings = Object.assign({}, formData.settings, {
            components: Array.isArray(formData.components) ? formData.components : [],
          });
        }
        delete formData.components;
        return formData;
      },
      // 表单重置
      resetForm() {
        vk.pubfn.resetForm(originalForms, this);
      },
    },
  };
</script>

<style lang="scss" scoped>
  .line {
    padding-left: 10px;
    padding-right: 10px;
  }
</style>
