import { useEffect, useState } from 'react'
import { measureNaturalSize } from '../lib/image'
import type { Dimensions } from '../lib/image'

/**
 * 画像の実サイズ（横・縦 px）を測る React フック。読めない・未設定なら null。
 *
 * 幅を「原寸」にしているプリセットでも名前ラベルの行揃えや立ち絵の描画サイズ（背景方式）を
 * 使えるようにするために要る（出力CSSからは描画中の画像の実寸を参照できないので、測った数値を焼き込む）。
 */
export function useImageNaturalSize(imageUrl: string | undefined): Dimensions | null {
  const [size, setSize] = useState<Dimensions | null>(null)

  useEffect(() => {
    let alive = true
    setSize(null)
    if (!imageUrl) return
    measureNaturalSize(imageUrl).then((s) => {
      if (alive) setSize(s)
    })
    return () => {
      alive = false
    }
  }, [imageUrl])

  return size
}

/** 複数の画像URLの実サイズを測る。空URLと重複URLは測定しない。 */
export function useImageNaturalSizes(imageUrls: string[]): Record<string, Dimensions | null> {
  const [sizes, setSizes] = useState<Record<string, Dimensions | null>>({})
  const key = imageUrls.join('\n')

  useEffect(() => {
    let alive = true
    const uniqueUrls = [...new Set(key.split('\n').filter((url) => url !== ''))]
    setSizes(Object.fromEntries(uniqueUrls.map((url) => [url, null])))
    Promise.all(
      uniqueUrls.map(async (url) => [url, await measureNaturalSize(url)] as const),
    ).then((results) => {
      if (alive) setSizes(Object.fromEntries(results))
    })
    return () => {
      alive = false
    }
  }, [key])

  return sizes
}
