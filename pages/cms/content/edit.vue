<template>
  <view class="page-body">
    <view class="vk-page-card"><vk-page-header :title="pageTitle" :show-back="true"></vk-page-header></view>
    <view class="vk-page-card">
      <vk-data-form
        v-model="form1.data"
        ref="form1"
        :rules="form1.props.rules"
        :action="form1.props.action"
        :form-type="form1.props.formType"
        :columns="form1.props.columns"
        label-width="130px"
        @success="onSuccess"
      >
        <template v-slot:fields_relation="{ row, column }">
          <el-select
            v-model="row[column.key]"
            :placeholder="column.placeholder"
            filterable
            remote
            :remote-method="(keyword) => loadRelationOptions(column, keyword)"
            style="width: 100%"
          >
            <el-option v-for="opt in column.dicData || []" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
          </el-select>
        </template>
      </vk-data-form>
      <view style="text-align: center; margin-top: 20px">
        <el-button :size="$global.size" @click="goBack">返回</el-button>
        <el-button :size="$global.size" type="primary" @click="submitForm">保存</el-button>
      </view>
    </view>
  </view>
</template>

<script>
  let vk = uni.vk;
  let originalForms = {};
  let componentCache = {};
  let fieldTypeMap = {
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    switch: 'switch',
    radio: 'radio',
    checkbox: 'checkbox',
    select: 'select',
    'file-select': 'file-select',
    date: 'date',
    datetime: 'datetime',
    color: 'color',
    editor: 'editor',
    'remote-select': 'remote-select',
    relation: 'remote-select',
    json: 'json',
    component: 'component',
  };
  export default {
    data() {
      return {
        loading: false,
        data: {},
        modelInfo: {},
        pageTitle: '内容编辑',
        form1: { data: {}, props: { action: '', columns: [], rules: {}, formType: '' } },
      };
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    methods: {
      async init(options) {
        originalForms['form1'] = vk.pubfn.copyObject(this.form1);
        let { model_key, model_id, _id } = options;
        if (!model_key && !model_id) {
          vk.msg.error('缺少模型参数');
          return;
        }
        let modelKey = model_key;
        if (model_id && !model_key) {
          let mr = await vk.callFunction({ url: 'admin/cms/model/sys/getInfo', data: { _id: model_id } });
          if (mr.code === 0 && mr.info) modelKey = mr.info.key;
        }
        let res = await vk.callFunction({ url: 'admin/cms/model/sys/getInfo', data: { model_key: modelKey || model_key } });
        if (res.code === 0 && res.info) {
          this.modelInfo = res.info;
          this.pageTitle = (options._id ? '编辑' : '添加') + res.info.name;
          await this.generateFormConfig(res.info);
          if (options._id) {
            let er = await vk.callFunction({ url: 'admin/cms/content/sys/getInfo', data: { _id: options._id } });
            if (er.code === 0 && er.info) {
              this.form1.data = er.info;
              this.form1.props.formType = 'update';
              this.form1.props.action = 'admin/cms/content/sys/update';
            }
          } else {
            this.form1.props.formType = 'add';
            this.form1.props.action = 'admin/cms/content/sys/add';
            this.form1.data = { model_id: this.modelInfo._id, model_key: this.modelInfo.key, fields: {}, status: 1 };
          }
        }
      },
      async generateFormConfig(model) {
        let fields = model.fields || [];
        let sortedFields = [...fields].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        let cols = [];
        cols.push({ key: 'title', title: '条目标题', type: 'text', placeholder: '自动取首字段值，可手动修改', span: 24 });
        for (let f of sortedFields) {
          if (f.type === 'component') {
            let compCols = await this.buildComponentColumns(f);
            cols = cols.concat(compCols);
          } else {
            let formType = fieldTypeMap[f.type] || 'text';
            let col = this.buildFieldColumn(f, formType);
            cols.push(col);
          }
        }
        cols.push({ key: 'status', title: '状态', type: 'switch', defaultValue: 1, span: 12 });
        this.form1.props.columns = cols;
      },
      async buildComponentColumns(field) {
        let cols = [];
        let refKey = field.settings && field.settings.ref_component_key;
        if (!refKey) return cols;
        let compModel = componentCache[refKey];
        if (!compModel) {
          let res = await vk.callFunction({ url: 'admin/cms/model/sys/getInfo', data: { model_key: refKey } });
          if (res.code === 0 && res.info) {
            compModel = res.info;
            componentCache[refKey] = compModel;
          }
        }
        if (!compModel) {
          cols.push({ key: '_comp_' + field.key, title: field.title + '（未找到组件' + refKey + '）', type: 'text', disabled: true, span: 24 });
          return cols;
        }
        let compFields = (compModel.fields || []).sort((a, b) => (a.sort || 0) - (b.sort || 0));
        let isRepeatable = field.settings && field.settings.repeatable;
        if (isRepeatable) {
          cols.push({
            key: 'fields.' + field.key,
            title: field.title,
            type: 'array<object>',
            span: 24,
            showAdd: true,
            showSort: true,
            rightBtns: ['delete'],
            itemWidth: 360,
            defaultValue: {},
            columns: compFields.map((cf) => {
              let ft = fieldTypeMap[cf.type] || 'text';
              return { key: cf.key, title: cf.title, type: ft, required: cf.required, placeholder: cf.placeholder || '请输入' + cf.title, span: 12 };
            }),
          });
        } else {
          cols.push({ key: 'fields.' + field.key, title: '── ' + field.title + ' ──', type: 'divider', span: 24 });
          compFields.forEach((cf) => {
            let ft = fieldTypeMap[cf.type] || 'text';
            let col = this.buildFieldColumn(cf, ft, 'fields.' + field.key + '.');
            cols.push(col);
          });
        }
        return cols;
      },
      buildFieldColumn(f, formType, prefix) {
        let key = (prefix || 'fields.') + f.key;
        let col = { key, title: f.title, type: formType, required: f.required, placeholder: f.placeholder || '请输入' + f.title, span: 12 };
        if (formType === 'textarea' && f.settings && f.settings.rows) col.rows = f.settings.rows;
        if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') col.defaultValue = f.default_value;
        if (formType === 'select' || formType === 'radio' || formType === 'checkbox') {
          col.dicData = (f.settings && f.settings.data) || [];
          if (formType === 'checkbox' || (f.settings && f.settings.multiple)) col.multiple = true;
        }
        if (formType === 'file-select') {
          col.fileType = (f.settings && f.settings.fileType) || 'image';
          col.multiple = !!(f.settings && f.settings.multiple);
          if (f.settings && f.settings.multipleLimit) col.multipleLimit = f.settings.multipleLimit;
        }
        if (formType === 'remote-select') {
          col.dicData = [];
          if (f.relation) {
            col.ref_model_id = f.relation;
            col.action = 'admin/cms/content/pub/getContent';
            col.showAll = true;
            col.actionData = { model_id: f.relation, status: 'all' };
            this.loadRelationOptions(col, '');
          } else if (f.settings && f.settings.ref_model_key) {
            col.ref_model_key = f.settings.ref_model_key;
            col.action = 'admin/cms/content/pub/getContent';
            col.showAll = true;
            col.actionData = { model_key: f.settings.ref_model_key, status: 'all' };
            this.loadRelationOptions(col, '');
          }
          if (f.settings && f.settings.multiple) col.multiple = true;
        }
        // 处理显示条件
        if (f.condition && f.condition.length > 0) {
          col.showRule = this.buildShowRule(f.condition);
        }
        return col;
      },
      buildShowRule(condition) {
        if (!condition || condition.length === 0) return '';
        let parts = [];
        for (let i = 0; i < condition.length; i++) {
          let item = condition[i];
          if (!item.field || !item.operator) continue;
          let fieldKey = item.field;
          // 如果字段名不以 fields. 开头，则添加 fields. 前缀
          if (!fieldKey.startsWith('fields.')) {
            fieldKey = 'fields.' + fieldKey;
          }
          let part = fieldKey + item.operator + item.value;
          parts.push(part);
        }
        return parts.join('&&');
      },
      async loadRelationOptions(column, keyword) {
        if (column.ref_model_id) {
          let res = await vk.callFunction({ url: 'admin/cms/content/pub/getContent', data: { model_id: column.ref_model_id, searchvalue: keyword || '', status: 'all' } });
          if (res.code === 0) column.dicData = res.list || [];
          return;
        }
        if (!column.ref_model_key) return;
        let res = await vk.callFunction({ url: 'admin/cms/content/pub/getContent', data: { model_key: column.ref_model_key, searchvalue: keyword || '', status: 'all' } });
        if (res.code === 0) column.dicData = res.list || [];
      },
      submitForm() {
        this.$refs.form1.submit();
      },
      onSuccess() {
        vk.msg.toast('保存成功');
        setTimeout(() => vk.navigateTo('/pages/cms/content/list?model_key=' + this.modelInfo.key), 500);
      },
      goBack() {
        vk.navigateTo('/pages/cms/content/list?model_key=' + this.modelInfo.key);
      },
    },
  };
</script>
