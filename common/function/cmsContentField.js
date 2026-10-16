/**
 * CMS 内容模型字段 → 万能表格/万能表单 列配置工具
 * 根据内容模型的 fields 配置，生成表格列、查询列、表单列、校验规则、状态开关列等
 */
let vk = uni.vk;
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

/**
 * 生成表格展示列
 * @param {Object} field 字段配置
 * @param {String} formType 表单类型（fieldTypeMap 映射后的值）
 */
function buildTableColumn(field, formType) {
  let column = { key: field.key, title: field.title, type: 'text', width: 150 };
  if (formType === 'switch') column.type = 'switch';
  else if (formType === 'file-select') {
    let fileType = field.fileType || (field.settings && field.settings.fileType) || 'image';
    if (fileType === 'image') {
      column.type = 'image';
      column.width = 100;
    }
  } else if (formType === 'number') {
    column.type = 'number';
    column.width = 100;
  } else if (formType === 'date') {
    column.type = 'date';
    column.valueFormat = 'yyyy-MM-dd';
    column.width = 110;
  } else if (formType === 'datetime') {
    column.type = 'time';
    column.valueFormat = 'yyyy-MM-dd hh:mm:ss';
    column.width = 160;
  }
  return column;
}

/**
 * 生成表单列
 * @param {Object} field 字段配置
 * @param {String} formType 表单类型（fieldTypeMap 映射后的值）
 * @param {Object} options 其他配置，如 { contentPubAction: 'admin/cms/content/pub/getContent' }
 */
function buildFormColumn(field, formType, options = {}) {
  let col = {
    key: field.key,
    title: field.title,
    type: formType,
  };
  if (formType === 'editor') {
    col.type = 'custom';
    col.component = 'custom-editor-tinymce';
    col.width = (field.settings && field.settings.width) || 750;
    col.height = (field.settings && field.settings.height) || 500;
    col.placeholder = (field.settings && field.settings.placeholder) || '开始输入...';
  }
  if (formType === 'textarea' && field.settings && field.settings.rows) col.rows = field.settings.rows;
  if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') col.defaultValue = field.default_value;
  if (formType === 'select' || formType === 'radio' || formType === 'checkbox') {
    col.dicData = (field.settings && field.settings.data) || [];
    if (formType === 'checkbox' || (field.settings && field.settings.multiple)) col.multiple = true;
  }
  if (formType === 'file-select') {
    col.fileType = (field.settings && field.settings.fileType) || 'image';
    col.multiple = !!(field.settings && field.settings.multiple);
    if (field.settings && field.settings.multipleLimit) col.multipleLimit = field.settings.multipleLimit;
  }
  if (formType === 'remote-select') {
    if (!(field.relation || (field.settings && field.settings.ref_model_key))) {
      col.type = 'text';
    } else {
      col.action = options.contentPubAction || 'admin/cms/content/pub/getContent';
      col.showAll = true;
      col.actionData = field.relation ? { model_id: field.relation, status: 'all' } : { model_key: field.settings.ref_model_key, status: 'all' };
      if (field.settings && field.settings.multiple) col.multiple = true;
    }
  }
  // 处理显示条件
  if (vk.pubfn.isNotNull(field.condition)) {
    col.showRule = Object.values(field.condition).join(' ');
  }
  return col;
}

/**
 * 生成状态开关列（发布/下架）
 * @param {String} contentAction 内容云对象 action 前缀，如 'admin/cms/sys.content'
 */
function buildStatusColumn(contentAction) {
  return {
    key: 'status',
    title: '状态',
    type: 'switch',
    width: 80,
    activeValue: true,
    inactiveValue: false,
    watch: (res) => {
      let { value, row, change } = res;
      vk.callFunction({
        url: contentAction + '.update',
        title: value ? '发布中...' : '下架中...',
        data: { _id: row._id, model_id: row.model_id, status: value },
        success: () => {
          change(value);
        },
      });
    },
  };
}

export default {
  fieldTypeMap,
  buildTableColumn,
  buildFormColumn,
  buildStatusColumn,
};
