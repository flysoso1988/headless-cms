<template>
  <view class="model-layout">
    <!-- 左侧模型列表 -->
    <view class="model-sidebar">
      <view class="sidebar-search">
        <el-input v-model="searchKeyword" placeholder="搜索模型" prefix-icon="el-icon-search" size="small" clearable @input="filterModels"></el-input>
      </view>
      <view class="model-list">
        <template v-for="group in groupedModels">
          <view class="model-group" :key="group.type">
            <view class="group-header">
              <span class="group-title">{{ group.label }}</span>
              <span class="group-add" @click.stop="addBtn(group.type)"><i class="el-icon-plus"></i></span>
            </view>
            <view class="group-items">
              <view v-for="item in group.items" :key="item._id" class="model-item" :class="{ active: currentModel && currentModel._id === item._id }" @click="selectModel(item)">
                <span class="model-name">{{ item.name }}</span>
                <i class="el-icon-delete model-delete-icon" @click.stop="deleteModel(item)"></i>
              </view>
            </view>
          </view>
        </template>
        <view v-if="groupedModels.length === 0" class="empty-tip">暂无模型</view>
      </view>
    </view>

    <!-- 右侧字段列表 -->
    <view class="model-content">
      <view v-if="currentModel">
        <view class="content-header">
          <view class="content-title">
            <span>{{ currentModel.name }}</span>
            <el-divider direction="vertical"></el-divider>
            <span>{{ currentModel.key }}</span>
          </view>
          <view class="content-actions">
            <el-button size="small" icon="el-icon-edit" @click="updateBtn(currentModel)">编辑</el-button>
            <el-button type="primary" size="small" icon="el-icon-plus" @click="addField">添加字段</el-button>
          </view>
        </view>
        <view class="field-list">
          <draggable v-model="currentModel.fields" handle=".sort-icon" @change="sortHandle">
            <view class="field-item" v-for="field in currentModel.fields" :key="field._id">
              <view class="sort-icon">
                <vk-data-icon name="el-icon-rank" :size="14" color="#c0c4cc"></vk-data-icon>
              </view>
              <view class="field-info">
                <span class="field-name">{{ field.title }}</span>
                <span class="field-key">{{ field.key }}<span v-if="field.required" class="field-required">*</span></span>
                <el-tag size="mini" type="info">{{ getFieldTypeLabel(field.type) }}</el-tag>
              </view>
              <view class="field-actions">
                <i class="el-icon-edit action-icon" @click="editField(field)"></i>
                <i class="el-icon-delete action-icon" @click="deleteField(field)"></i>
              </view>
            </view>
          </draggable>
          <view v-if="!currentModel.fields || currentModel.fields.length === 0" class="empty-fields">暂无字段，点击"添加字段"添加 </view>
        </view>
      </view>
      <view v-else class="empty-content">
        <i class="el-icon-document"></i>
        <p>请选择左侧模型查看字段</p>
      </view>
    </view>

    <!-- 模型编辑弹窗 -->
    <vk-data-dialog v-model="modelForm.props.show" :title="modelForm.props.title" width="500px" mode="form" :close-on-click-modal="false">
      <vk-data-form
        v-model="modelForm.data"
        :rules="modelForm.props.rules"
        :action="modelForm.props.action"
        :form-type="modelForm.props.formType"
        :columns="modelForm.props.columns"
        label-width="120px"
        @success="
          modelForm.props.show = false;
          loadModels();
        "
      ></vk-data-form>
    </vk-data-dialog>

    <!-- 字段编辑弹窗 -->
    <fieldUpdate v-model="formDatas.fieldUpdate" @success="loadModels"></fieldUpdate>
  </view>
</template>

<script>
  let vk = uni.vk;
  let originalModelForm = {};
  import fieldUpdate from './form/fieldUpdate.vue';
  import draggable from 'vuedraggable';

  const fieldTypeData = [
    {
      value: 'text',
      label: '单行文本',
    },
    {
      value: 'textarea',
      label: '多行文本',
    },
    {
      value: 'number',
      label: '数字',
    },
    {
      value: 'switch',
      label: '开关',
    },
    {
      value: 'radio',
      label: '单选',
    },
    {
      value: 'checkbox',
      label: '多选',
    },
    {
      value: 'select',
      label: '下拉选择',
    },
    {
      value: 'file-select',
      label: '文件选择',
    },
    {
      value: 'date',
      label: '日期',
    },
    {
      value: 'datetime',
      label: '日期时间',
    },
    {
      value: 'color',
      label: '颜色',
    },
    {
      value: 'editor',
      label: '富文本',
    },
    {
      value: 'remote-select',
      label: '远程选择',
    },
    {
      value: 'json',
      label: 'JSON',
    },
    {
      value: 'dynamiczone',
      label: '动态区块',
    },
    {
      value: 'component',
      label: '组件',
    },
  ];
  export default {
    components: {
      fieldUpdate,
      draggable,
    },
    data() {
      return {
        loading: false,
        models: [],
        filteredModels: [],
        currentModel: null,
        searchKeyword: '',
        formDatas: {
          fieldUpdate: {
            show: false,
            mode: 'add',
            item: {},
            modelId: '',
          },
        },
        modelForm: {
          data: {
            type: 'collection',
          },
          props: {
            action: '',
            columns: [
              {
                key: 'name',
                title: '模型名称',
                type: 'text',
                placeholder: '请输入模型名称',
              },
              {
                key: 'key',
                title: '模型标识',
                type: 'text',
                placeholder: '英文小写，如 product',
              },
              {
                key: 'draft',
                title: '草稿箱',
                type: 'switch',
                defaultValue: true,
              },
              {
                key: 'internationalization',
                title: '多语言',
                type: 'switch',
                defaultValue: false,
              },
            ],
            rules: {},
            formType: '',
            show: false,
          },
        },
      };
    },
    computed: {
      groupedModels() {
        const groups = [];
        const typeConfig = [
          {
            type: 'collection',
            label: '集合',
          },
          {
            type: 'single',
            label: '单页',
          },
          {
            type: 'component',
            label: '组件',
          },
        ];
        for (const config of typeConfig) {
          const items = this.filteredModels.filter((m) => m.type === config.type);
          groups.push({
            type: config.type,
            label: config.label,
            items,
          });
        }
        return groups;
      },
    },
    onLoad(options = {}) {
      vk = this.vk;
      this.options = options;
      this.init(options);
    },
    methods: {
      init(options) {
        originalModelForm = vk.pubfn.copyObject(this.modelForm);
        this.loadModels();
      },
      resetModelForm() {
        vk.pubfn.resetForm(
          {
            modelForm: originalModelForm,
          },
          this
        );
      },
      loadModels() {
        const that = this;
        vk.callFunction({
          url: 'admin/cms/sys.model.getList',
          title: '请求中...',
          success: (res) => {
            this.models = res.rows || [];
            this.filterModels();
            if (this.currentModel) {
              const found = this.models.find((m) => m._id === this.currentModel._id);
              this.currentModel = found || null;
            }
          },
        });

        this.loading = false;
      },
      filterModels() {
        if (!this.searchKeyword) {
          this.filteredModels = [...this.models];
        } else {
          const keyword = this.searchKeyword.toLowerCase();
          this.filteredModels = this.models.filter((item) => item.name.toLowerCase().includes(keyword) || item.key.toLowerCase().includes(keyword));
        }
      },
      async selectModel(item) {
        this.currentModel = item;
      },
      getFieldTypeLabel(value) {
        const item = fieldTypeData.find((t) => t.value === value);
        return item ? item.label : value;
      },
      addBtn(type) {
        this.resetModelForm();
        this.modelForm.props.action = 'admin/cms/sys.model.add';
        this.modelForm.props.formType = 'add';
        this.modelForm.props.title = '新建模型';
        this.modelForm.data.type = type;
        this.modelForm.props.show = true;
      },
      updateBtn(item) {
        this.modelForm.props.action = 'admin/cms/sys.model.update';
        this.modelForm.props.formType = 'update';
        this.modelForm.props.title = '编辑模型';
        this.modelForm.props.show = true;
        this.modelForm.data = item;
      },
      deleteModel(item) {
        vk.confirm(`确定要删除模型"${item.name}"吗？`, '提示', '确定', '取消', (res) => {
          if (res.confirm) {
            vk.callFunction({
              url: 'admin/cms/sys.model.delete',
              data: {
                _id: item._id,
              },
              success: (res) => {
                if (this.currentModel && this.currentModel._id === item._id) {
                  this.currentModel = null;
                }
                this.models = this.models.filter((f) => f._id !== item._id);
                this.filterModels();
                vk.toast('删除成功');
              },
            });
          }
        });
      },
      addField() {
        if (!this.currentModel) return;
        const { _id, fields = [] } = this.currentModel;
        vk.pubfn.openForm(
          'fieldUpdate',
          {
            mode: 'add',
            item: {
              model_id: _id,
              sort: fields.length,
            },
          },
          this
        );
      },
      editField(row) {
        vk.pubfn.openForm(
          'fieldUpdate',
          {
            mode: 'update',
            item: row,
          },
          this
        );
      },
      deleteField(row) {
        vk.confirm(`确定要删除字段"${row.title}"吗？`, '提示', '确定', '取消', (res) => {
          if (res.confirm) {
            vk.callFunction({
              url: 'admin/cms/sys.field.delete',
              data: {
                _id: row._id,
              },
              success: (res) => {
                this.currentModel.fields = this.currentModel.fields.filter((f) => f._id !== row._id);
                vk.toast('删除成功');
              },
            });
          }
        });
      },
      sortHandle() {
        const ids = vk.pubfn.arrayObjectGetArray(this.currentModel.fields, '_id');
        console.log('ids:', ids);
        vk.callFunction({
          url: 'admin/cms/sys.field.sort',
          data: {
            ids,
          },
        });
      },
    },
  };
</script>

<style lang="scss" scoped>
  .model-layout {
    display: flex;
    height: calc(100vh - 70px);
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
  }

  .model-sidebar {
    width: 260px;
    border-right: 1px solid #ebeef5;
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  .sidebar-search {
    padding: 12px;
  }

  .model-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .model-group {
    margin-bottom: 4px;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    color: #666687;
    background: #fff;
  }

  .group-add {
    cursor: pointer;
    color: #909399;
    font-size: 14px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;

    &:hover {
      color: #409eff;
      background: #ecf5ff;
    }
  }

  .group-items {
    padding: 4px;
  }

  .model-item {
    display: flex;
    align-items: center;
    padding: 8px 12px 8px 28px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 14px;
    color: #32324d;
    text-decoration: none;
    border-radius: 4px;

    &:hover {
      background: #f5f7fa;
    }

    &.active {
      background: #ecf5ff;
      color: #409eff;
      font-weight: bold;
    }
  }

  .model-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
  }

  .model-delete-icon {
    display: none;
    cursor: pointer;
    font-size: 13px;
    color: #909399;
    padding: 2px;
    border-radius: 3px;
    flex-shrink: 0;

    &:hover {
      color: #f56c6c;
      background: #fef0f0;
    }
  }

  .model-item:hover .model-delete-icon {
    display: inline-block;
  }

  .empty-tip {
    padding: 40px 20px;
    text-align: center;
    color: #909399;
    font-size: 14px;
  }

  .model-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f6f6f9;
  }

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f6f6f9;
  }

  .content-title {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    display: flex;
    align-items: center;
  }

  .content-actions {
    display: flex;
    gap: 8px;
  }

  .field-list {
    margin: 16px 20px;
    overflow: auto;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }

  .field-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 16px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
      border-bottom: none;
    }
  }

  .field-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sort-icon {
    cursor: move;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;

    &:hover {
      background-color: #f6f6f9;
    }
  }

  .field-required {
    color: #f56c6c;
    font-size: 14px;
    margin-left: 2px;
  }

  .field-name {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    min-width: 100px;
  }

  .field-key {
    font-size: 13px;
    color: #909399;
    font-family: monospace;
    min-width: 140px;
  }

  .field-actions {
    display: flex;
    gap: 12px;
  }

  .action-icon {
    cursor: pointer;
    font-size: 14px;
    color: #909399;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      color: #409eff;
      background: #ecf5ff;
    }
  }

  .empty-fields {
    padding: 40px 20px;
    text-align: center;
    color: #909399;
    font-size: 14px;
    background: #fafafa;
    border-radius: 4px;
  }

  .empty-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #909399;

    i {
      font-size: 48px;
      margin-bottom: 16px;
    }

    p {
      font-size: 14px;
    }
  }
</style>
