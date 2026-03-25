/**
 * 统一的 adapter 返回类型
 * 所有 shared/adapters/ 下的函数都返回这个结构
 */
export interface AdapterResult<T> {
  success: boolean
  data?: T
  error?: string
}

/** 构造成功结果 */
export function ok<T>(data: T): AdapterResult<T> {
  return { success: true, data }
}

/** 构造失败结果 */
export function fail<T = never>(error: string): AdapterResult<T> {
  return { success: false, error }
}

/**
 * 包装一个 async 函数，自动 try-catch 并返回 AdapterResult
 */
export async function wrapAsync<T>(fn: () => Promise<T>): Promise<AdapterResult<T>> {
  try {
    const data = await fn()
    return ok(data)
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
