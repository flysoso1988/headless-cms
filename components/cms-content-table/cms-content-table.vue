<template>
  <view class="cms-content-table">
    <view class="content-main-header">
      <span class="content-main-title">{{ model.name }}列表</span>
      <el-button type="primary" size="small" icon="el-icon-plus" @click="addBtn">添加{{ model.name }}</el-button>
    </view>
    <view class="vk-page-card" style="margin-top: 10px">
      <view class="vk-page-card-toolbar">
        <view class="toolbar-placeholder"> aaa </view>
        <view class="vk-page-card-actions">
          <el-select v-if="model.internationalization" v-model="locale" size="small" class="locale-select" @change="onLocaleChange">
            <el-option v-for="opt in localeOptions" :key="opt.value" :label="opt.label" :value="opt.value"></el-option>
          </el-select>
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
          :auto-action="false"
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
  let vk = uni.vk;
  export default {
    name: 'cms-content-table',
    props: {
      // 内容模型（含 fields 字段配置）
      model: { type: Object, required: true },
      // 内容 CRUD 云对象 action 前缀，如 'admin/cms/sys.content'
      contentAction: { type: String, default: 'admin/cms/sys.content' },
      // 附加固定查询条件，会合并进列表查询（如 { site_id: 'xxx' }）
      extraData: { type: Object, default: () => ({}) },
    },
    data() {
      return {
        columnPopoverVisible: false,
        // 内容语言候选清单，从 i18n 接口动态获取
        localeOptions: [],
        // 语言列表是否已加载完成，未完成前多语言模型不发列表请求
        localeOptionsLoaded: false,
        // 同一轮内的重复刷新合并标记
        refreshScheduled: false,
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
          query: {},
        },
      };
    },
    computed: {
      // 当前内容语言：Vuex 持久化，跨模型、跨页面（编辑页）共享
      // 需要 setter，否则 v-model 写不回 Vuex，下拉框显示的仍是旧语言
      locale: {
        get() {
          return vk.getVuex('$app.locale');
        },
        set(val) {
          vk.setVuex('$app.locale', val);
        },
      },
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
      localeOptions() {
        if (this.localeOptions.length > 0) {
          this.generateConfig();
        }
      },
      locale(val) {
        // 其他页面（如内容编辑页）修改了语言时，同步列表查询条件
        if (this.queryForm1.query) this.queryForm1.query.locale = val;
      },
    },
    mounted() {
      vk = this.vk;
      this.loadLocaleOptions();
    },
    methods: {
      loadLocaleOptions() {
        vk.callFunction({
          url: 'admin/setting/sys.i18n.select',
          success: (res) => {
            let list = res.list || [];
            // 尚未选择语言时，默认选中设置中的默认语言（无默认则取第一项）
            if (vk.pubfn.isNull(this.locale) && list.length > 0) {
              let defaultOpt = list.find((opt) => opt.is_default) || list[0];
              vk.setVuex('$app.locale', defaultOpt.value);
            }
            this.localeOptionsLoaded = true;
            this.localeOptions = list;
          },
          complete: () => {
            // 请求失败或返回空列表时 watch 不会触发，这里兜底放行一次列表请求
            if (!this.localeOptionsLoaded) {
              this.localeOptionsLoaded = true;
              this.scheduleRefresh();
            }
          },
        });
      },
      // 合并同一轮内多次 generateConfig 产生的刷新，只向云端发一次列表请求
      scheduleRefresh() {
        // 多语言模型的查询条件依赖 locale，语言列表未就绪前不发请求，加载完成后会再触发一次
        if (this.model && this.model.internationalization && !this.localeOptionsLoaded) return;
        if (this.refreshScheduled) return;
        this.refreshScheduled = true;
        this.$nextTick(() => {
          this.refreshScheduled = false;
          if (this.$refs.table1) this.$refs.table1.refresh();
        });
      },
      generateConfig() {
        let model = this.model;
        if (!model || !model._id) return;
        let config = vk.myfn.buildTableConfig({ model, contentAction: this.contentAction, locale: this.locale, extraData: this.extraData });
        if (!config) return;
        // 状态开关列插入到创建时间列之前
        let timeIndex = config.allColumns.findIndex((c) => c.key === '_add_time');
        config.allColumns.splice(timeIndex, 0, vk.myfn.buildStatusColumn({ contentAction: this.contentAction }));
        this.allColumns = config.allColumns;
        this.columnOptions = config.columnOptions;
        this.checkedCols = config.checkedCols;
        this.table1.columns = config.columns;
        this.table1.action = config.action;
        this.queryForm1.columns = config.searchColumns;
        this.queryForm1.formData = config.formData;
        this.queryForm1.query = config.query;
        this.scheduleRefresh();
      },
      addBtn() {
        // 新增的内容归属于当前选中的语言（非多语言模型时不传 locale）
        this.$emit('add', { locale: this.model.internationalization ? this.locale : '' });
      },
      onLocaleChange(val) {
        // v-model 已通过 computed 写入 Vuex，这里同步查询条件后重新搜索
        if (this.queryForm1.query) this.queryForm1.query.locale = val;
        this.search();
      },
      updateBtn({ item }) {
        this.$emit('update', { item });
      },
      deleteBtn({ item, deleteFn }) {
        deleteFn({ action: this.contentAction + '.delete', data: { _id: item._id } });
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
            url: 'admin/cms/sys.model.update',
            data: { _id: this.model._id, display_fields: this.checkedCols },
          });
        }
        this.scheduleRefresh();
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
  .content-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 10px;
  }

  .content-main-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .toolbar-placeholder {
    flex: 1;
  }

  .locale-select {
    width: 110px;
    margin-right: 10px;
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
