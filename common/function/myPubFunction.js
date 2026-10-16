/**
 * 自定义公共函数
 */
let myfn = {};
/**
 * 测试函数test1
 * vk.myfn.test1();
 */
myfn.test1 = function (obj = {}) {
  let vk = uni.vk;
  console.log('执行了自定义公共函数test1');
  return obj;
};

// CMS 内容模型字段类型 → 万能表格/万能表单组件类型的映射
let cmsFieldTypeMap = {
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
 * 生成内容管理的万能表格配置（表格列、查询列、查询参数）
 * vk.myfn.buildTableConfig({ model, contentAction, locale, extraData });
 * @param {Object} options
 * @param {Object} options.model 内容模型（含 fields 字段配置）
 * @param {String} options.contentAction 内容 CRUD 云对象 action 前缀，如 'admin/cms/sys.content'
 * @param {String} options.locale 当前内容语言（多语言模型按语言过滤列表）
 * @param {Object} options.extraData 附加固定查询条件，如 { site_id: 'xxx' }
 * @returns {Object|null} 配置对象；model 为空时返回 null
 */
myfn.buildTableConfig = function (options = {}) {
  let { model, contentAction = 'admin/cms/sys.content', locale = '', extraData = {} } = options;
  if (!model || !model._id) return null;
  let fields = model.fields || [];
  // list_config.search_fields 指定了哪些字段可作为查询条件，空数组表示全部可用字段都可查
  let searchFields = (model.list_config && model.list_config.search_fields) || [];
  let sortedFields = [...fields].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  let titleField = sortedFields.find((f) => f.type === 'text');

  let cols = []; // 内容字段生成的表格列
  let searchCols = []; // 查询表单列
  let hasTitleField = false;
  sortedFields.forEach((f) => {
    if (f.type === 'component') return; // 组件占位字段不渲染
    let formType = cmsFieldTypeMap[f.type] || 'text';
    // 按字段类型生成表格列
    let col = { key: f.key, title: f.title, type: 'text', width: 150 };
    if (formType === 'switch') {
      col.type = 'switch';
    } else if (formType === 'file-select') {
      // 图片类型字段用缩略图展示
      let fileType = f.fileType || (f.settings && f.settings.fileType) || 'image';
      if (fileType === 'image') {
        col.type = 'image';
        col.width = 100;
      }
    } else if (formType === 'number') {
      col.type = 'number';
      col.width = 100;
    } else if (formType === 'date') {
      col.type = 'date';
      col.valueFormat = 'yyyy-MM-dd';
      col.width = 110;
    } else if (formType === 'datetime') {
      col.type = 'time';
      col.valueFormat = 'yyyy-MM-dd hh:mm:ss';
      col.width = 160;
    }
    cols.push(col);
    // 文本/多行文本/数字类字段可作查询条件
    if (formType === 'text' || formType === 'textarea' || formType === 'number') {
      if (!titleField || f.key === titleField.key) hasTitleField = true;
      if (searchFields.length === 0 || searchFields.includes(f.key)) {
        searchCols.push({ key: f.key, title: f.title, type: formType === 'number' ? 'number' : 'text', width: 160, mode: '%%' });
      }
    }
  });
  // 没有字段被识别为标题列时，把第一个文本字段补到最前面当标题列
  if (!hasTitleField && titleField) {
    cols.unshift({ key: titleField.key, title: titleField.title, type: 'text', width: 200 });
  }

  let allCols = [...cols];
  // 创建时间列
  allCols.push({ key: '_add_time', title: '创建时间', type: 'time', width: 160, sortable: 'custom' });

  // 显示字段：优先取模型里持久化的显示配置，过滤掉已不存在的字段
  let saveFields = model.display_fields || [];
  let validFields = allCols.filter((c) => saveFields.includes(c.key)).map((c) => c.key);
  let checkedCols = validFields.length > 0 ? validFields : allCols.map((c) => c.key);

  // 查询列兜底：没有可用查询字段时默认按标题查
  if (searchCols.length === 0) searchCols.push({ key: 'title', title: '标题', type: 'text', width: 160, mode: '%%' });
  searchCols.push({ key: 'model_id', title: '所属模型', hidden: true });

  // 列表查询参数：过滤草稿；多语言模型按当前语言过滤
  let query = { draft: model.draft };
  if (model.internationalization) query.locale = locale;

  return {
    columns: allCols.filter((c) => checkedCols.includes(c.key)), // 实际展示的列
    allColumns: allCols, // 全部列（显示字段设置弹窗用）
    columnOptions: allCols.map((c) => ({ key: c.key, title: c.title })), // 显示字段勾选项
    checkedCols: checkedCols, // 勾选的显示字段
    action: contentAction + '.getList', // 列表数据接口
    searchColumns: searchCols, // 查询表单列
    formData: Object.assign({ model_id: model._id }, extraData), // 查询表单固定数据
    query: query, // 列表查询条件
  };
};

/**
 * 生成内容管理的万能表单配置（表单列、校验规则）
 * vk.myfn.buildFormConfig({ model, contentPubAction });
 * @param {Object} options
 * @param {Object} options.model 内容模型（含 fields 字段配置）
 * @param {String} options.contentPubAction 关联内容远程下拉的数据源接口
 * @returns {Object} { columns, rules }；model 为空时返回空配置
 */
myfn.buildFormConfig = function (options = {}) {
  let { model, contentPubAction = 'admin/cms/content/pub/getContent' } = options;
  if (!model || !model._id) return { columns: [], rules: {} };
  let fields = model.fields || [];
  let formCols = []; // 表单列
  let rules = {}; // 校验规则
  let sortedFields = [...fields].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  sortedFields.forEach((f) => {
    if (f.type === 'component') return; // 组件占位字段不渲染
    let formType = cmsFieldTypeMap[f.type] || 'text';
    let col = { key: f.key, title: f.title, type: formType };
    // 富文本字段使用自定义编辑器组件
    if (formType === 'editor') {
      col.type = 'custom';
      col.component = 'custom-editor-tinymce';
      col.width = (f.settings && f.settings.width) || 750;
      col.height = (f.settings && f.settings.height) || 500;
      col.placeholder = (f.settings && f.settings.placeholder) || '开始输入...';
    }
    if (formType === 'textarea' && f.settings && f.settings.rows) col.rows = f.settings.rows;
    if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') col.defaultValue = f.default_value;
    // 下拉/单选/多选：选项数据与多选设置
    if (formType === 'select' || formType === 'radio' || formType === 'checkbox') {
      col.dicData = (f.settings && f.settings.data) || [];
      if (formType === 'checkbox' || (f.settings && f.settings.multiple)) col.multiple = true;
    }
    // 文件选择：文件类型与多选设置
    if (formType === 'file-select') {
      col.fileType = (f.settings && f.settings.fileType) || 'image';
      col.multiple = !!(f.settings && f.settings.multiple);
      if (f.settings && f.settings.multipleLimit) col.multipleLimit = f.settings.multipleLimit;
    }
    // 关联内容远程下拉：未配置关联模型时退化为文本框
    if (formType === 'remote-select') {
      if (!(f.relation || (f.settings && f.settings.ref_model_key))) {
        col.type = 'text';
      } else {
        col.action = contentPubAction;
        col.showAll = true;
        col.actionData = f.relation ? { model_id: f.relation, status: 'all' } : { model_key: f.settings.ref_model_key, status: 'all' };
        if (f.settings && f.settings.multiple) col.multiple = true;
      }
    }
    // 显示条件：condition 对象的值拼接为 showRule 表达式
    if (vk.pubfn.isNotNull(f.condition)) col.showRule = Object.values(f.condition).join(' ');
    formCols.push(col);
    // 必填校验规则
    if (f.required) {
      rules[f.key] = [{ required: true, message: f.title + '不能为空', trigger: ['blur', 'change'] }];
    }
  });
  return { columns: formCols, rules };
};

/**
 * 生成内容状态开关列（发布/下架，切换时调用内容更新接口）
 * vk.myfn.buildStatusColumn({ contentAction });
 * @param {Object} options
 * @param {String} options.contentAction 内容 CRUD 云对象 action 前缀，如 'admin/cms/sys.content'
 * @returns {Object} 表格状态列配置
 */
myfn.buildStatusColumn = function (options = {}) {
  let { contentAction = 'admin/cms/sys.content' } = options;
  return {
    key: 'status',
    title: '状态',
    type: 'switch',
    width: 80,
    activeValue: true,
    inactiveValue: false,
    watch: (res) => {
      let { value, row, change } = res;
      uni.vk.callFunction({
        url: contentAction + '.update',
        title: value ? '发布中...' : '下架中...',
        data: { _id: row._id, model_id: row.model_id, status: value },
        success: () => {
          change(value);
        },
      });
    },
  };
};

/**
 * 生成新增内容表单的默认数据（模型字段默认值 + 附加数据）
 * vk.myfn.buildFormDefaultData({ model, extraData });
 * @param {Object} options
 * @param {Object} options.model 内容模型（含 fields 字段配置）
 * @param {Object} options.extraData 附加固定数据，如 { site_id: 'xxx' }
 * @returns {Object} 表单默认数据
 */
myfn.buildFormDefaultData = function (options = {}) {
  let { model = {}, extraData = {} } = options;
  let data = { model_id: model._id, status: !model.draft };
  (model.fields || []).forEach((f) => {
    if (f.default_value !== undefined && f.default_value !== null && f.default_value !== '') {
      data[f.key] = f.default_value;
    }
  });
  return Object.assign(data, extraData);
};

export default myfn;
