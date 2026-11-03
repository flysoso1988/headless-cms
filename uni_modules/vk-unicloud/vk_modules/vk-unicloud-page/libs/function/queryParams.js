/**
 * 对象转url参数
 * @param {*} data,对象
 * @param {*} isPrefix,是否自动加上"?"
 * @param {String} arrayFormat,数组格式：indices、brackets、repeat、comma
 * @param {Object} options,可选配置
 * @param {Boolean} options.encode,是否编码参数名和值，默认false
 * @param {Boolean} options.keepEmpty,是否保留空字符串参数，默认false
 * 此函数参考uView
 */
function queryParams(data = {}, isPrefix = true, arrayFormat = 'brackets', options = {}) {
  const { encode = false, keepEmpty = false } = options;
  const formatParam = (key, value) => {
    return encode ? `${encodeURIComponent(key)}=${encodeURIComponent(value)}` : `${key}=${value}`;
  };
  let newData = JSON.parse(JSON.stringify(data));
  let prefix = isPrefix ? '?' : '';
  let _result = [];
  if (['indices', 'brackets', 'repeat', 'comma'].indexOf(arrayFormat) == -1) arrayFormat = 'brackets';
  for (let key in newData) {
    let value = newData[key];
    // 默认去掉空字符串，null和undefined始终忽略
    if (value === undefined || value === null || (value === '' && !keepEmpty)) {
      continue;
    }
    // 如果值为数组，另行处理
    if (value.constructor === Array) {
      // e.g. {ids: [1, 2, 3]}
      switch (arrayFormat) {
        case 'indices':
          // 结果: ids[0]=1&ids[1]=2&ids[2]=3
          for (let i = 0; i < value.length; i++) {
            _result.push(formatParam(key + '[' + i + ']', value[i]));
          }
          break;
        case 'brackets':
          // 结果: ids[]=1&ids[]=2&ids[]=3
          value.forEach((_value) => {
            _result.push(formatParam(key + '[]', _value));
          });
          break;
        case 'repeat':
          // 结果: ids=1&ids=2&ids=3
          value.forEach((_value) => {
            _result.push(formatParam(key, _value));
          });
          break;
        case 'comma':
          // 结果: ids=1,2,3
          let commaStr = '';
          value.forEach((_value) => {
            commaStr += (commaStr ? ',' : '') + _value;
          });
          _result.push(formatParam(key, commaStr));
          break;
        default:
          value.forEach((_value) => {
            _result.push(formatParam(key + '[]', _value));
          });
      }
    } else {
      _result.push(formatParam(key, value));
    }
  }
  return _result.length ? prefix + _result.join('&') : '';
}

export default queryParams;
