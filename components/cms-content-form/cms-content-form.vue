<template>
  <vk-data-form
    v-model="formData"
    ref="formRef"
    :rules="formConfig.rules"
    :action="finalAction"
    :form-type="formType"
    :columns="formConfig.columns"
    :label-width="labelWidth"
    :footer-show="footerShow"
    @success="onFormSuccess"
  ></vk-data-form>
</template>

<script>
  import cmsContentField from '@/common/function/cmsContentField.js';
  export default {
    name: 'cms-content-form',
    props: {
      // 内容模型（含 fields 字段配置）
      model: { type: Object, required: true },
      // 表单类型 'add' 新增 / 'update' 编辑
      formType: { type: String, default: 'add' },
      // 表单数据（v-model 双向绑定）
      value: { type: Object, default: () => ({}) },
      // 自定义云函数 action，不传则根据 formType 自动生成
      action: { type: String, default: '' },
      // 内容 CRUD 云对象 action 前缀，如 'admin/cms/sys.content'
      contentAction: { type: String, default: 'admin/cms/sys.content' },
      // 远程下拉（关联内容）数据源 action
      contentPubAction: { type: String, default: 'admin/cms/content/pub/getContent' },
      // 附加固定数据，会合并进新增表单默认数据（如 { site_id: 'xxx' }）
      extraData: { type: Object, default: () => ({}) },
      labelWidth: { type: String, default: '120px' },
      // 是否显示组件自带的底部按钮，页面自行渲染保存/返回按钮时传 false
      footerShow: { type: Boolean, default: true },
    },
    watch: {
      value: {
        handler() {
          this.syncDefaultData();
        },
        immediate: true,
      },
      'model._id'() {
        this.syncDefaultData();
      },
      formType() {
        this.syncDefaultData();
      },
    },
    computed: {
      formData: {
        get() {
          return this.value;
        },
        set(val) {
          this.$emit('input', val);
        },
      },
      finalAction() {
        return this.action || this.contentAction + '.' + this.formType;
      },
      formConfig() {
        let model = this.model;
        if (!model || !model._id) return { columns: [], rules: {} };
        let fields = model.fields || [];
        let formCols = [];
        let rules = {};
        let sortedFields = [...fields].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        sortedFields.forEach((f) => {
          if (f.type === 'component') return;
          let formType = cmsContentField.fieldTypeMap[f.type] || 'text';
          formCols.push(cmsContentField.buildFormColumn(f, formType, { contentPubAction: this.contentPubAction }));
          if (f.required) {
            rules[f.key] = [{ required: true, message: f.title + '不能为空', trigger: ['blur', 'change'] }];
          }
        });
        formCols.push({ key: 'status', title: '发布', type: 'switch', defaultValue: !model.draft });
        return { columns: formCols, rules };
      },
    },
    methods: {
      buildDefaultData() {
        let model = this.model || {};
        let data = { model_id: model._id, status: !model.draft };
        (model.fields || []).forEach((f) => {
          if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') {
            data[f.key] = f.default_value;
          }
        });
        return Object.assign(data, this.extraData);
      },
      /**
       * 新增模式下把模型默认值补齐进表单数据。
       * model 与 extraData 均由页面异步传入，组件初始化时可能还是空对象，
       * 因此默认数据需要在依赖就绪后重新同步，而不是只在 created 时构建一次。
       */
      syncDefaultData() {
        if (this.formType !== 'add') return;
        let model = this.model;
        if (!model || !model._id) return;
        let current = this.value || {};
        let next = Object.assign({}, this.buildDefaultData(), current);
        let changed = Object.keys(next).length !== Object.keys(current).length || next.model_id !== current.model_id;
        if (changed) this.$emit('input', next);
      },
      /**
       * 获取完整的表单配置（供弹窗场景 openForm 展开使用）
       * @param {String} mode 表单模式 'add' 新增 / 'update' 编辑
       * @param {Object} item 编辑时传入的数据（含 _id）
       */
      getFormConfig(mode, item) {
        let isUpdate = mode === 'update';
        return {
          action: this.contentAction + '.' + (isUpdate ? 'update' : 'add'),
          formType: isUpdate ? 'update' : 'add',
          columns: this.formConfig.columns,
          rules: this.formConfig.rules,
          data: isUpdate ? item || {} : this.buildDefaultData(),
        };
      },
      /** 重置为新增默认数据 */
      reset() {
        this.$emit('input', this.buildDefaultData());
      },
      /** 提交表单（供自定义提交按钮调用） */
      submit() {
        if (this.$refs.formRef) this.$refs.formRef.submitForm();
      },
      onFormSuccess() {
        this.$emit('success');
      },
    },
  };
</script>

<style lang="scss" scoped></style>
