import { DEFAULT_OPTIONS, type AppState, type GenerateOptions, type TachieUser } from './types'

/**
 * 設定の永続化。data URI は数MB規模になり URL 共有には載らないため localStorage のみを使う
 * （URL 永続化は data URI サイズの都合で採用しない）。
 */

const STORAGE_KEY = 'obs-tachie-generator:v1'

function isUser(v: unknown): v is TachieUser {
  if (typeof v !== 'object' || v === null) return false
  const u = v as Record<string, unknown>
  return typeof u.id === 'string' && typeof u.name === 'string' && typeof u.imageUrl === 'string'
}

/** 保存値をマージして欠損キーを既定で補い、型を保証する。 */
export function normalizeState(raw: unknown): AppState {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const users = Array.isArray(obj.users) ? obj.users.filter(isUser) : []
  const rawOptions = (typeof obj.options === 'object' && obj.options !== null
    ? obj.options
    : {}) as Partial<GenerateOptions>
  const options: GenerateOptions = {
    ...DEFAULT_OPTIONS,
    ...rawOptions,
    speak: { ...DEFAULT_OPTIONS.speak, ...(rawOptions.speak ?? {}) },
  }
  return { users, options }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return normalizeState(null)
    return normalizeState(JSON.parse(raw))
  } catch {
    return normalizeState(null)
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 容量超過（data URI が大きい場合など）は黙って諦める。生成自体には影響しない。
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
