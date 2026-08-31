/**
 * T 或 null（不含 undefined）。
 * 主要用于函数参数和返回值，避免显式标注 undefined 的必要。
 */
type Nullable<T> = T | null
