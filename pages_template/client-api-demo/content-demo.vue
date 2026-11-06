<template>
  <view class="content-demo-page">
    <vk-title title="内容查询接口示例" />

    <vk-card title="1. 获取内容列表" type="line">
      <vk-form :form-data="listFormData" :columns="listFormColumns" ref="listForm">
        <template v-slot:footer>
          <el-button type="primary" @click="fetchList">查询列表</el-button>
        </template>
      </vk-form>

      <vk-data-table
        v-if="listData.rows"
        :data="listData.rows"
        :columns="listColumns"
        :pagination="false"
        border
      />
    </vk-card>

    <vk-card title="2. 获取内容详情" type="line" style="margin-top: 20px">
      <vk-form :form-data="detailFormData" :columns="detailFormColumns" ref="detailForm">
        <template v-slot:footer>
          <el-button type="primary" @click="fetchDetail">查询详情</el-button>
        </template>
      </vk-form>

      <el-descriptions v-if="detailData" :column="2" border style="margin-top: 20px">
        <el-descriptions-item label="ID">{{ detailData._id }}</el-descriptions-item>
        <el-descriptions-item label="文档ID">{{ detailData.document_id }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ detailData.title }}</el-descriptions-item>
        <el-descriptions-item label="作者">{{ detailData.author }}</el-descriptions-item>
        <el-descriptions-item label="语言">{{ detailData.locale }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detailData.status ? 'success' : 'info'">
            {{ detailData.status ? '已发布' : '未发布' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发布时间" :span="2">
          {{ detailData.publish_time | vk_dateTime }}
        </el-descriptions-item>
        <el-descriptions-item label="摘要" :span="2">
          {{ detailData.description }}
        </el-descriptions-item>
        <el-descriptions-item label="正文" :span="2">
          <div v-html="detailData.content"></div>
        </el-descriptions-item>
      </el-descriptions>
    </vk-card>

    <vk-card title="3. 代码示例" type="line" style="margin-top: 20px">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="vk.importObject 方式" name="import">
          <pre class="code-block">{{ importObjectCode }}</pre>
        </el-tab-pane>
        <el-tab-pane label="URL 化 HTTP 方式" name="url">
          <pre class="code-block">{{ urlHttpCode }}</pre>
        </el-tab-pane>
      </el-tabs>
    </vk-card>
  </view>
</template>

<script>
let vk = uni.vk;

export default {
  data() {
    return {
      // 列表查询表单
      listFormData: {
        model_key: 'article',
        locale: 'zh-Hans',
        pageIndex: 1,
        pageSize: 10,
        keyword: '',
      },
      listFormColumns: [
        { key: 'model_key', title: '模型标识', type: 'text', placeholder: '如：article' },
        { key: 'locale', title: '语言', type: 'text', placeholder: '如：zh-Hans' },
        { key: 'pageIndex', title: '页码', type: 'number' },
        { key: 'pageSize', title: '每页数量', type: 'number' },
        { key: 'keyword', title: '关键词', type: 'text', placeholder: '搜索标题' },
      ],

      // 列表数据
      listData: {},
      listColumns: [
        { key: '_id', title: 'ID', type: 'text', width: 200 },
        { key: 'title', title: '标题', type: 'text', width: 300 },
        { key: 'author', title: '作者', type: 'text', width: 120 },
        { key: 'locale', title: '语言', type: 'text', width: 100 },
        {
          key: 'status',
          title: '状态',
          type: 'tag',
          width: 100,
          tagType: (val) => (val ? 'success' : 'info'),
          formatter: (val) => (val ? '已发布' : '未发布'),
        },
        { key: 'publish_time', title: '发布时间', type: 'time', width: 180 },
      ],

      // 详情查询表单
      detailFormData: {
        document_id: '',
        locale: 'zh-Hans',
      },
      detailFormColumns: [
        { key: 'document_id', title: '文档ID', type: 'text', placeholder: '必填' },
        { key: 'locale', title: '语言', type: 'text', placeholder: '可选' },
      ],

      // 详情数据
      detailData: null,

      // 代码示例
      activeTab: 'import',
      importObjectCode: `// 导入云对象
const contentApi = vk.importObject('client/pub.content');

// 获取列表
async function loadList() {
  let res = await contentApi.getList({
    data: {
      model_key: 'article',
      locale: 'zh-Hans',
      pageIndex: 1,
      pageSize: 10
    }
  });
  console.log(res.rows);
}

// 获取详情
async function loadDetail() {
  let res = await contentApi.getInfo({
    data: {
      document_id: 'abc123',
      locale: 'zh-Hans'
    }
  });
  console.log(res.info);
}`,
      urlHttpCode: `// 使用 vk.request()
vk.request({
  url: 'https://xxx.bspapp.com/http/router/client/pub/content.getList',
  method: 'POST',
  data: {
    model_key: 'article',
    locale: 'zh-Hans',
    pageIndex: 1,
    pageSize: 10
  },
  success: (res) => {
    console.log(res.data.rows);
  }
});

// 或使用 uni.request()
uni.request({
  url: 'https://xxx.bspapp.com/http/router/client/pub/content.getInfo',
  method: 'POST',
  data: {
    document_id: 'abc123',
    locale: 'zh-Hans'
  },
  success: (res) => {
    console.log(res.data.info);
  }
});`,
    };
  },
  onLoad() {
    vk = this.vk;
  },
  methods: {
    // 查询列表
    async fetchList() {
      try {
        vk.showLoading('加载中...');

        // 方式一：使用 vk.importObject
        const contentApi = vk.importObject('client/pub.content');
        let res = await contentApi.getList({
          data: this.listFormData,
        });

        /* 
        // 方式二：使用 vk.callFunction
        let res = await vk.callFunction({
          url: 'client/pub.content.getList',
          data: this.listFormData,
        });
        */

        this.listData = res;
        vk.hideLoading();
        vk.toast('查询成功', 'success');
      } catch (err) {
        console.error('查询失败：', err);
        vk.hideLoading();
        vk.toast(err.msg || '查询失败', 'none');
      }
    },

    // 查询详情
    async fetchDetail() {
      if (!this.detailFormData.document_id) {
        vk.toast('请输入文档ID', 'none');
        return;
      }

      try {
        vk.showLoading('加载中...');

        // 方式一：使用 vk.importObject
        const contentApi = vk.importObject('client/pub.content');
        let res = await contentApi.getInfo({
          data: this.detailFormData,
        });

        /* 
        // 方式二：使用 vk.callFunction
        let res = await vk.callFunction({
          url: 'client/pub.content.getInfo',
          data: this.detailFormData,
        });
        */

        this.detailData = res.info;
        vk.hideLoading();
        vk.toast('查询成功', 'success');
      } catch (err) {
        console.error('查询失败：', err);
        vk.hideLoading();
        vk.toast(err.msg || '查询失败', 'none');
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.content-demo-page {
  padding: 20px;
}

.code-block {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
