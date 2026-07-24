/**
 * 画像ソースの解決。Streamkit オーバーレイの CSP(`img-src`)で表示できるホストの URL は
 * そのまま使い、それ以外は data URI に変換して埋め込む。ユーザーが明示指定もできる。
 *
 * 注意: 許可ホスト一覧は「実用上安全と分かっている範囲」のベストエフォート。厳密な CSP は
 * Streamkit 側の更新で変わりうるため、判定できないものは data URI 化(またはアップロード)に倒す。
 */

/** どうやって画像を CSS に載せるか。 */
export type ImageSourceMode = 'auto' | 'url' | 'dataUri'

/** Streamkit の CSP `img-src` が許可すると分かっているホスト(サフィックス一致)。 */
export const STREAMKIT_ALLOWED_HOST_SUFFIXES = [
  'discordapp.com',
  'discord.com',
  'discordapp.net',
  'imgur.com',
] as const

/** data URI か。 */
export function isDataUri(url: string): boolean {
  return /^data:/i.test(url.trim())
}

/**
 * その URL が Streamkit の CSP で「そのまま表示できる」と判断できるか。
 * data:/blob: は埋め込み系なので true。http(s) はホストが許可リストのサフィックスに一致すれば true。
 */
export function isStreamkitAllowedImageUrl(url: string): boolean {
  const u = url.trim()
  if (/^(data|blob):/i.test(u)) return true
  let parsed: URL
  try {
    parsed = new URL(u)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  const host = parsed.hostname.toLowerCase()
  return STREAMKIT_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
}

/** 外部 URL を取得して data URI に変換する。CORS 非対応ホストでは失敗しうる。 */
export async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  if (!res.ok) throw new Error(`画像の取得に失敗しました (HTTP ${res.status})`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('画像として取得できませんでした')
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('変換に失敗しました'))
    reader.readAsDataURL(blob)
  })
}

/** 解決結果。`imageUrl` が実際に CSS へ載る値、`note` は UI 表示用の説明。 */
export interface ResolvedImageSource {
  imageUrl: string
  /** 実際にどう載ったか。 */
  applied: 'url' | 'dataUri'
  /** ユーザー向けの一言(空なら特記なし)。 */
  note: string
  /** 想定通りにできなかった場合の警告(空なら問題なし)。 */
  warning: string
}

/**
 * モードに従って入力 URL を解決する。
 * - `url`    : そのまま使う。
 * - `dataUri`: data URI 化(失敗したら URL のままにして警告)。
 * - `auto`   : 許可ホストなら URL のまま、そうでなければ data URI 化を試み、失敗したら URL のまま＋警告。
 */
export async function resolveImageSource(
  input: string,
  mode: ImageSourceMode = 'auto',
): Promise<ResolvedImageSource> {
  const url = input.trim()

  if (isDataUri(url)) {
    return { imageUrl: url, applied: 'dataUri', note: 'data URI（埋め込み済み）', warning: '' }
  }

  if (mode === 'url') {
    const allowed = isStreamkitAllowedImageUrl(url)
    return {
      imageUrl: url,
      applied: 'url',
      note: 'URL のまま使用',
      warning: allowed
        ? ''
        : 'このホストは Streamkit の CSP で弾かれる可能性があります（表示されないかも）。',
    }
  }

  if (mode === 'dataUri') {
    try {
      const dataUri = await urlToDataUri(url)
      return { imageUrl: dataUri, applied: 'dataUri', note: 'data URI に変換して埋め込み', warning: '' }
    } catch {
      return {
        imageUrl: url,
        applied: 'url',
        note: 'URL のまま使用',
        warning:
          'data URI に変換できませんでした（CORS 等）。画像をダウンロードしてアップロードしてください。',
      }
    }
  }

  // auto
  if (isStreamkitAllowedImageUrl(url)) {
    return {
      imageUrl: url,
      applied: 'url',
      note: '許可ホストなので URL のまま使用',
      warning: '',
    }
  }
  try {
    const dataUri = await urlToDataUri(url)
    return {
      imageUrl: dataUri,
      applied: 'dataUri',
      note: '非許可ホストのため data URI に変換して埋め込み',
      warning: '',
    }
  } catch {
    return {
      imageUrl: url,
      applied: 'url',
      note: 'URL のまま使用',
      warning:
        '非許可ホストですが data URI 変換に失敗しました（CORS 等）。ダウンロードしてアップロード推奨。',
    }
  }
}
