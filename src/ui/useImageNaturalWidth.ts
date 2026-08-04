import { useEffect, useState } from 'react'
import { measureNaturalWidth } from '../lib/image'

/**
 * 画像の実サイズ（幅 px）を測る React フック。読めない・未設定なら null。
 *
 * 幅を「原寸」にしているプリセットでも名前ラベルの行揃えを使えるようにするために要る
 * （出力CSSからは描画中の画像の実寸を参照できないので、測った数値を焼き込む）。
 */
export function useImageNaturalWidth(imageUrl: string | undefined): number | null {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setWidth(null)
    if (!imageUrl) return
    measureNaturalWidth(imageUrl).then((w) => {
      if (alive) setWidth(w)
    })
    return () => {
      alive = false
    }
  }, [imageUrl])

  return width
}
