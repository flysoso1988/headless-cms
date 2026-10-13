<template>
  <view class="cms-content-table">
    <view class="vk-page-card" style="margin-top: 10px">
      <view class="vk-page-card-toolbar">
        <view class="toolbar-placeholder"></view>
        <view class="vk-page-card-actions">
          <el-popover placement="bottom-end" width="240" trigger="click" :visible.sync="columnPopoverVisible" popper-class="column-setting-popover" @show="onColumnPopoverShow">
            <view slot="reference" class="action-icon-btn">
              <vk-data-icon name="el-icon-setting"></vk-data-icon>
            </view>
            <view class="column-setting-content">
              <view class="column-setting-header">
                <span class="column-setting-title">显示字段</span>
              </view>
              <el-checkbox-group v-model="checkedCols" @change="applyColumnVisibility">
                <view class="column-checkbox-item" v-for="opt in columnOptions" :key="opt.key">
                  <el-checkbox :label="opt.key">{{ opt.title }}</el-checkbox>
                </view>
              </el-checkbox-group>
            </view>
          </el-popover>
        </view>
      </view>
      <view class="vk-page-card-table">
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
        </vk-data-table>
      </view>
    </view>
  </view>
</template>

<script>
  import cmsContentField from '@/common/function/cmsContentField.js';
  let vk = uni.vk;
  export default {
    name: 'cms-content-table',
    props: {
      // 内容模型（含 fields 字段配置）
      model: { type: Object, required: true },
      // 内容 CRUD 云函数 action 前缀
      contentAction: { type: String, default: 'admin/cms/content/sys' },
      // 模型云函数 action 前缀（用于持久化显示字段配置）
      modelAction: { type: String, default: 'admin/cms/model/sys' },
      // 附加固定查询条件，会合并进列表查询（如 { site_id: 'xxx' }）
      extraData: { type: Object, default: () => ({}) },
    },
    data() {
      return {
        columnPopoverVisible: false,
        columnOptions: [],
        checkedCols: [],
        allColumns: [],
        table1: {
          action: '',
          columns: [],
        },
        queryForm1: {
          formData: {},
          columns: [],
        },
      };
    },
    watch: {
      model: {
        handler() {
          this.generateConfig();
        },
        deep: true,
        immediate: true,
      },
      extraData: {
        handler() {
          this.generateConfig();
        },
        deep: true,
      },
    },
    mounted() {
      vk = this.vk;
    },
    methods: {
      generateConfig() {
        let model = this.model;
        if (!model || !model._id) return;
        let fields = model.fields || [];
        let cols = [];
        let searchCols = [];
        let searchFields = (model.list_config && model.list_config.search_fields) || [];
        let sortedFields = [...fields].sort((a, b) => (a.sort || 0) - (b.sort || 0));
        let titleField = sortedFields.find((f) => f.type === 'text');
        let hasTitleField = false;
        sortedFields.forEach((f) => {
          if (f.type === 'component') return;
          let formType = cmsContentField.fieldTypeMap[f.type] || 'text';
          let col = cmsContentField.buildTableColumn(f, formType);
          cols.push(col);
          if (formType === 'text' || formType === 'textarea' || formType === 'number') {
            if (!titleField || f.key === titleField.key) hasTitleField = true;
            let searchCol = { key: f.key, title: f.title, type: formType === 'number' ? 'number' : 'text', width: 160, mode: '%%' };
            if (searchFields.length === 0 || searchFields.includes(f.key)) searchCols.push(searchCol);
          }
        });
        if (!hasTitleField && titleField) {
          cols.unshift({ key: titleField.key, title: titleField.title, type: 'text', width: 200 });
        }
        let allCols = [...cols];
        allCols.push(cmsContentField.buildStatusColumn(this.contentAction));
        allCols.push({ key: '_add_time', title: '创建时间', type: 'time', width: 160, sortable: 'custom' });
        this.allColumns = allCols;
        this.columnOptions = allCols.map((c) => ({ key: c.key, title: c.title }));
        // 读取模型持久化的显示字段配置（过滤掉已不存在的字段）
        let saveFields = model.display_fields || [];
        let validFields = allCols.filter((c) => saveFields.includes(c.key)).map((c) => c.key);
        this.checkedCols = validFields.length > 0 ? validFields : allCols.map((c) => c.key);
        this.table1.columns = allCols.filter((c) => this.checkedCols.includes(c.key));
        this.table1.action = this.contentAction + '/getList';
        if (searchCols.length === 0) searchCols.push({ key: 'title', title: '标题', type: 'text', width: 160, mode: '%%' });
        searchCols.push({ key: 'model_id', title: '所属模型', hidden: true });
        this.queryForm1.columns = searchCols;
        this.queryForm1.formData = Object.assign({ model_id: model._id }, this.extraData);
        this.$nextTick(() => {
          if (this.$refs.table1) this.$refs.table1.refresh();
        });
      },
      updateBtn({ item }) {
        this.$emit('update', { item });
      },
      deleteBtn({ item, deleteFn }) {
        deleteFn({ action: this.contentAction + '/delete', data: { _id: item._id } });
      },
      onColumnPopoverShow() {
        if (!this.allColumns || this.allColumns.length === 0) {
          this.generateConfig();
        }
      },
      applyColumnVisibility() {
        let checkedSet = new Set(this.checkedCols);
        this.table1.columns = this.allColumns.filter((c) => checkedSet.has(c.key));
        // 将显示字段配置持久化到模型集合
        if (this.model && this.model._id) {
          this.model.display_fields = this.checkedCols;
          vk.callFunction({
            url: this.modelAction + '/update',
            data: { _id: this.model._id, display_fields: this.checkedCols },
          });
        }
        this.$nextTick(() => {
          if (this.$refs.table1) this.$refs.table1.refresh();
        });
      },
      refresh() {
        this.$refs.table1.refresh();
      },
      search() {
        this.$refs.table1.search();
      },
    },
  };
</script>

<style lang="scss" scoped>
  .toolbar-placeholder {
    flex: 1;
  }

  .action-icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.2s;

    &:hover {
      border-color: #409eff;
    }
  }

  .column-setting-content {
    padding: 4px 2px;
  }

  .column-setting-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
  }

  .column-setting-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .column-checkbox-item {
    display: flex;
    align-items: center;
    height: 30px;
  }
</style>
