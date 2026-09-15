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
