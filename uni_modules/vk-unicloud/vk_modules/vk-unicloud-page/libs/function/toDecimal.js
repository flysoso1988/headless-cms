const BASE = 100000000;

/**
 * 计算截断位置：
 * cut = length - fractionLength + exponent + precision。
 *
 * 使用高低两段整数运算，避免超大指数与精度相互抵消时丢失精度。
 * 返回 -1 表示位置小于 0，返回 length 表示无需截断。
 */
function getCut(exponent, precision, length, fractionLength) {
  const negative = exponent.charAt(0) === '-';
  const text = exponent.replace(/^[+-]?0*/, '') || '0';

  // precision 与长度偏移均在安全整数范围内，
  // 无法抵消绝对值达到 10^17 的指数。
  if (text.length > 17) {
    return negative ? -1 : length;
  }

  const sign = negative ? -1 : 1;
  const offset = length - fractionLength;
  const precisionLow = precision % BASE;
  const offsetLow = offset % BASE;

  let high = sign * Number(text.slice(0, -8) || '0') + (precision - precisionLow) / BASE + (offset - offsetLow) / BASE;

  let low = sign * Number(text.slice(-8)) + precisionLow + offsetLow;

  high += Math.floor(low / BASE);
  low = ((low % BASE) + BASE) % BASE;

  if (high < 0) {
    return -1;
  }

  const lengthLow = length % BASE;
  const lengthHigh = (length - lengthLow) / BASE;

  if (high > lengthHigh || (high === lengthHigh && low >= lengthLow)) {
    return length;
  }

  // 此时结果位于 [0, length)，可以安全合并为 Number。
  return high * BASE + low;
}

/**
 * 十进制整数字符串加一，不将整个整数转换成 Number。
 */
function increment(text) {
  let index = text.length - 1;

  while (index >= 0 && text.charAt(index) === '9') {
    index--;
  }

  if (index < 0) {
    return '1' + '0'.repeat(text.length);
  }

  return text.slice(0, index) + String(Number(text.charAt(index)) + 1) + '0'.repeat(text.length - index - 1);
}

/**
 * 按十进制规则保留小数，返回 Number，不依赖 BigInt。
 *
 * 舍入规则：
 * - 不足一半舍去，超过一半进位。
 * - 恰好一半时向正无穷舍入，与 Math.round 的半值规则一致。
 * - 例如：1.005 → 1.01，-1.005 → -1，-1.00501 → -1.01。
 *
 * 支持：
 * - 有限数字、十进制数字字符串、科学计数法。
 * - null、undefined、空字符串和纯空白字符串返回 0，仍需通过精度校验。
 * - 正精度、零精度、负精度。
 * - 保留负零，不使用浮点乘除缩放、EPSILON 或 toFixed。
 *
 * 注意：
 * - 字符串按原始十进制内容舍入；Number 输入无法恢复此前已经丢失的精度。
 * - 返回值仍受 Number 表示精度限制，不能保留末尾的 0。
 * - 非法参数、输入溢出、舍入结果溢出均抛出异常。
 *
 * @param {number|string|null|undefined} val 原值
 * @param {number|string} [precision=0] 精度，必须是安全整数；-2 表示舍入到百位
 * @returns {number}
 *
 * @example
 * toDecimal(1.005, 2);                    // 1.01
 * toDecimal(-1.005, 2);                   // -1
 * toDecimal(-1.00501, 2);                 // -1.01
 * toDecimal(100000000.005, 2);            // 100000000.01
 * toDecimal(1.00000005, 7);               // 1.0000001
 * toDecimal('1.004999999999999999999', 2); // 1
 * toDecimal('5e-7', 6);                   // 0.000001
 * toDecimal(123456, -4);                 // 120000
 */
function toDecimal(val, precision = 0) {
  if (typeof precision === 'string' && precision.trim() !== '') {
    precision = Number(precision);
  }

  if (!Number.isSafeInteger(precision)) {
    throw new RangeError('precision 必须是安全整数');
  }

  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    return 0;
  }

  if (typeof val !== 'number' && typeof val !== 'string') {
    throw new TypeError('val 必须是有限数字或十进制数字字符串');
  }

  // 保留原始十进制字符串，避免提前转换导致舍入依据丢失。
  const source = String(val).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(source);

  if (!match) {
    throw new TypeError('val 必须是有限数字或十进制数字字符串');
  }

  // 仅用于范围检查，以及无需舍入时的返回值。
  const numberValue = Number(source);

  if (!Number.isFinite(numberValue)) {
    throw new RangeError('val 超出 Number 的有限数值范围');
  }

  const negative = match[1] === '-' || Object.is(val, -0);
  const fraction = match[3] || match[4] || '';
  const digits = ((match[2] || '') + fraction).replace(/^0+/, '');

  if (digits === '') {
    return negative ? -0 : 0;
  }

  const cut = getCut(match[5] || '0', precision, digits.length, fraction.length);

  if (cut >= digits.length) {
    return numberValue;
  }

  if (cut < 0) {
    return negative ? -0 : 0;
  }

  const nextDigit = digits.charCodeAt(cut) - 48;

  // 负数恰好半值时不增加绝对值，超过半值时才增加绝对值。
  const roundUp = nextDigit > 5 || (nextDigit === 5 && (!negative || /[1-9]/.test(digits.slice(cut + 1))));

  let integer = digits.slice(0, cut) || '0';

  if (roundUp) {
    integer = increment(integer);
  }

  // 将已舍入的十进制结果一次性转换为 Number，避免浮点乘除缩放。
  const result = Number(`${negative ? '-' : ''}${integer}e${-precision}`);

  if (!Number.isFinite(result)) {
    throw new RangeError('舍入结果超出 Number 的有限数值范围');
  }

  return result;
}

export default toDecimal;
