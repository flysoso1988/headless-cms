<template>
  <div class="vk-data-loading" :style="styleCom" v-if="valueCom">
    <div v-if="mask" class="mask" :style="maskStyleCom" @click.stop.prevent="stopPrevent" @touchmove.stop.prevent="stopPrevent"></div>
    <div class="loading" v-if="loadingImage || delayTimeCom == 0">
      <loading-style :color="color" :animation-type="animationType" :image="image" :image-style="imageStyle"></loading-style>
      <span class="text" :style="titleStyle">{{ title }}</span>
    </div>
  </div>
</template>

<script>
  import loadingStyle from './loading-style.vue';
  import defaultLoadingImage from '@/static/icon/loading.gif';
  /**
   * loading 请求遮罩层
   * @property {Boolean} v-model 是否显示loading
   * @property {String} timeout 超时时间（秒） 默认30s
   * @property {String} title 提示的文字
   * @property {Boolean} mask 是否显示遮罩层
   * @property {String} maskBackgroundColor 遮罩层的背景色，默认为透明色
   * @property {Number} timeout 超时时间，单位秒，默认30秒，超过后会自动隐藏loading，并触发timeout事件
   * @property {String} image loading的图片地址
   * @property {String} top 距离顶部的距离，默认40vh
   * @property {Number} z-index 层级
   * @property {Number} delay-time 延迟多少毫秒才显示loading图标（在延迟期间，遮罩依然存在，只是完全透明看不见，依然有防止连续点击二次的效果）
   * @property {Boolean} show-image 是否显示图片
   * @property {Object} imageStyle 图片样式
   * @property {Object} titleStyle 标题文本样式
   * @property {Boolean} errorToast 超时后是否自动显示toast提示
   * @property {String} errorTitle 超时后显示的提示文字
   * @property {String} animationType 动画类型，可选值：image(图片)、circle(圆环)、wave(波浪)、dots(圆点)，默认image
   * @property {String} color 动画颜色，默认#007aff
   * @event {Function} timeout 超时后触发
   * @example <vk-data-loading v-model="loading" :delayTime="800" :timeout="30" :errorToast="false"></vk-data-loading>
   * @example <vk-data-loading v-model="loading" animationType="circle" color="#ff6b6b"></vk-data-loading>
   */
  export default {
    components: {
      loadingStyle,
    },
    name: 'vk-data-loading',
    emits: ['update:modelValue', 'input', 'timeout'],
    props: {
      value: {
        type: Boolean,
        default: false,
      },
      modelValue: {
        type: Boolean,
        default: false,
      },
      // 提示语
      title: {
        type: String,
        default: '',
      },
      // 是否显示遮罩
      mask: {
        type: Boolean,
        default: true,
      },
      // 遮罩背景色
      maskBackgroundColor: {
        type: String,
        default: 'rgba(0,0,0,0)', // rgba(0,0,0,0.2)
      },
      // 动画类型
      animationType: {
        type: String,
        default: 'image',
        validator: function (value) {
          return ['image', 'circle', 'wave', 'dots'].indexOf(value) !== -1;
        },
      },
      // 动画颜色
      color: {
        type: String,
        default: '#007aff',
      },
      // 超时时间
      timeout: {
        type: Number,
        default: 30,
      },
      // 图片地址
      image: {
        type: String,
        default: defaultLoadingImage,
      },
      // 层级
      zIndex: {
        type: [String, Number],
        default: 99999999,
      },
      // 延迟多少毫秒才显示loading图标（在延迟期间，遮罩依然存在，只是完全透明看不见，依然有防止连续点击二次的效果）
      delayTime: {
        type: [String, Number],
        default: 500,
      },
      // 图片样式
      imageStyle: {
        type: [String, Object],
      },
      // 标题样式
      titleStyle: {
        type: [String, Object],
      },
      // 超时后是否自动显示toast提示
      errorToast: {
        type: Boolean,
        default: true,
      },
      // 超时后显示的提示文字
      errorTitle: {
        type: String,
        default: '加载超时，请重试',
      },
    },
    data() {
      return {
        loadingImage: false,
      };
    },
    // #ifdef VUE2
    destroyed() {
      this.clearTimers();
    },
    // #endif

    // #ifdef VUE3
    unmounted() {
      this.clearTimers();
    },
    // #endif
    methods: {
      stopPrevent() {},
      clearTimers() {
        if (this._timer) {
          clearTimeout(this._timer);
          this._timer = null;
        }
        if (this._loadingImageTimer) {
          clearTimeout(this._loadingImageTimer);
          this._loadingImageTimer = null;
        }
      },
      // 显示
      showLoading() {
        this.clearTimers();
        let { delayTimeCom } = this;
        if (delayTimeCom > 0) this.loadingImage = false;
        this._loadingImageTimer = setTimeout(() => {
          this._loadingImageTimer = null;
          this.loadingImage = true;
        }, delayTimeCom);
        if (this.timeout > 0) {
          this._timer = setTimeout(() => {
            this._timer = null;
            if (this.valueCom) {
              this.$emit('input', false);
              this.$emit('update:modelValue', false);
              this.$emit('timeout');
              if (this.errorToast) {
                uni.showToast({
                  title: this.errorTitle,
                  icon: 'none',
                });
              }
            }
          }, this.timeout * 1000);
        }
      },
    },
    // 监听属性
    watch: {
      valueCom: {
        handler(val) {
          if (!val) {
            this.clearTimers();
            this.loadingImage = false;
          } else {
            this.showLoading();
          }
        },
        immediate: true,
      },
    },
    // 计算属性
    computed: {
      valueCom() {
        // #ifdef VUE2
        return this.value;
        // #endif

        // #ifdef VUE3
        return this.modelValue;
        // #endif
      },
      styleCom() {
        let obj = {};
        let { zIndex } = this;
        if (zIndex) {
          obj.zIndex = zIndex;
        }
        return obj;
      },
      delayTimeCom() {
        let { delayTime } = this;
        return !isNaN(delayTime) ? Number(delayTime) : 0;
      },
      maskBackgroundColorCom() {
        let { delayTimeCom, maskBackgroundColor, loadingImage } = this;
        if (delayTimeCom) {
          return loadingImage ? maskBackgroundColor : 'rgba(0,0,0,0)';
        } else {
          return maskBackgroundColor;
        }
      },
      animationStyle() {
        return {
          '--animation-color': this.color,
          '--animation-color-alpha': this.color + '20',
        };
      },
      maskStyleCom() {
        return {
          backgroundColor: this.maskBackgroundColorCom,
        };
      },
    },
  };
</script>

<style scoped lang="scss">
  .vk-data-loading {
    position: fixed;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    z-index: 99999999;
    display: flex;
    width: 100vw;
    height: 100vh;
    justify-content: center;
    pointer-events: none;
  }

  .mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    pointer-events: auto;
  }

  .loading {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .text {
      color: #7e7e7e;
      text-align: center;
      margin-top: 5px;
      font-size: 14px;
    }
  }
</style>
