<template>
  <div class="vk-data-waiting">
    <loading-style v-if="!is_slot()" :size="size" :color="color" :animation-type="animationType"></loading-style>
    <div v-else class="vk-data-waiting-nested-loading">
      <!-- 延迟期间的透明遮罩 -->
      <div v-if="isDelaying" class="vk-data-waiting-delay-mask"></div>
      <!-- 加载遮罩 -->
      <div v-if="internalLoading" class="vk-data-waiting-mask" :class="{ 'is--loading': internalLoading }">
        <loading-style :size="size" :color="color" :animation-type="animationType"></loading-style>
        <span v-if="title" class="vk-data-waiting-text" :style="{ color }">{{ title }}</span>
      </div>
      <div class="vk-data-waiting-container" :class="{ 'vk-data-waiting-blur': internalLoading }">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
  import loadingStyle from '../vk-data-loading/loading-style.vue';
  /**
   * waiting 等待动画遮罩层组件
   * @property {Boolean} loading 是否显示等待动画
   * @property {String} title 提示文字，显示在动画下方
   * @property {String} size 动画大小，可选值：default、medium、mini，默认default
   * @property {String} color 动画颜色，默认#007aff
   * @property {String} animationType 动画类型，可选值：dots(圆点旋转)、circle(圆环)、wave(波浪)、image(图片)，默认dots
   * @property {Number|String} delayTime 延迟多少毫秒才显示动画，默认0
   * @example <vk-data-waiting :loading="true" title="加载中..." animationType="dots"></vk-data-waiting>
   */
  export default {
    name: 'vk-data-waiting',
    components: {
      loadingStyle,
    },
    props: {
      // 大小
      size: {
        type: String,
        default: 'default',
      },
      // 是否加载
      loading: {
        type: Boolean,
        default: false,
      },
      // 提示
      title: {
        type: String,
        default: '',
      },
      delayTime: {
        type: [Number, String],
        default: 0,
      },
      // 内置图标文字颜色
      color: {
        type: String,
        default: '#007aff', // #269939
      },
      // 动画类型
      animationType: {
        type: String,
        default: 'dots',
        validator: function (value) {
          return ['dots', 'circle', 'wave', 'image'].indexOf(value) !== -1;
        },
      },
    },
    data() {
      return {
        internalLoading: false,
        isDelaying: false,
        delayTimer: null,
      };
    },
    methods: {
      is_slot() {
        return Boolean(this.$slots.default || this.$scopedSlots.default);
      },
    },
    watch: {
      loading: {
        handler(newVal) {
          // 清除之前的定时器
          if (this.delayTimer) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
          }

          if (newVal) {
            // loading 为 true 时，延迟显示
            const delay = parseInt(this.delayTime) || 0;
            if (delay > 0) {
              // 设置延迟状态
              this.isDelaying = true;
              this.delayTimer = setTimeout(() => {
                this.isDelaying = false;
                this.internalLoading = true;
                this.delayTimer = null;
              }, delay);
            } else {
              this.internalLoading = true;
            }
          } else {
            // loading 为 false 时，立即隐藏
            this.isDelaying = false;
            this.internalLoading = false;
          }
        },
        immediate: true,
      },
    },
    beforeDestroy() {
      // 组件销毁前清除定时器
      if (this.delayTimer) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
    },
    created() {},
  };
</script>

<style lang="scss" scoped>
  .vk-data-waiting {
    .vk-data-waiting-nested-loading {
      position: relative;

      .vk-data-waiting-mask {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: absolute;
        left: 0%;
        right: 0%;
        top: 0%;
        bottom: 0%;
        z-index: 99999999;
        opacity: 0;
        transition: all 0.3s;

        .vk-data-waiting-text {
          font-size: 14px;
          color: red;
          margin-top: 10px;
        }

        &.is--loading {
          opacity: 1;
        }
      }

      .vk-data-waiting-delay-mask {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 99999998;
        background-color: transparent;
        pointer-events: auto;
      }

      .vk-data-waiting-container {
        position: relative;
        opacity: 1;
        transition: opacity 0.3s;

        &.vk-data-waiting-blur {
          opacity: 0.5;
          user-select: none;
          pointer-events: none;
        }
      }
    }
  }
</style>
