import { describe, expect, it } from 'vitest'
import { isDataUri, isStreamkitAllowedImageUrl, resolveImageSource } from './imageSource'

describe('isDataUri', () => {
  it('data URI を判定する', () => {
    expect(isDataUri('data:image/png;base64,AAAA')).toBe(true)
    expect(isDataUri('  data:image/png;base64,AAAA')).toBe(true)
    expect(isDataUri('https://ex.com/a.png')).toBe(false)
  })
})

describe('isStreamkitAllowedImageUrl', () => {
  it('data:/blob: は許可', () => {
    expect(isStreamkitAllowedImageUrl('data:image/png;base64,AAAA')).toBe(true)
    expect(isStreamkitAllowedImageUrl('blob:https://x/y')).toBe(true)
  })

  it('Discord 系ホストは許可', () => {
    expect(isStreamkitAllowedImageUrl('https://cdn.discordapp.com/x.png')).toBe(true)
    expect(isStreamkitAllowedImageUrl('https://media.discordapp.net/x.png')).toBe(true)
    expect(isStreamkitAllowedImageUrl('https://images.discord.com/x.png')).toBe(true)
  })

  it('imgur は許可', () => {
    expect(isStreamkitAllowedImageUrl('https://i.imgur.com/x.png')).toBe(true)
    expect(isStreamkitAllowedImageUrl('https://imgur.com/x.png')).toBe(true)
  })

  it('サフィックスの偽装は弾く', () => {
    expect(isStreamkitAllowedImageUrl('https://discordapp.com.evil.example/x.png')).toBe(
      false,
    )
    expect(isStreamkitAllowedImageUrl('https://notimgur.com/x.png')).toBe(false)
  })

  it('任意ホスト（Cloudflare Pages 等）は非許可', () => {
    expect(isStreamkitAllowedImageUrl('https://example.pages.dev/x.png')).toBe(false)
    expect(isStreamkitAllowedImageUrl('https://ytama-asset.example/x.png')).toBe(false)
  })

  it('不正な URL は非許可', () => {
    expect(isStreamkitAllowedImageUrl('not a url')).toBe(false)
    expect(isStreamkitAllowedImageUrl('')).toBe(false)
  })
})

describe('resolveImageSource（maxWidth は「URLのまま」には効かない）', () => {
  it('url モードはリサイズ対象外・URL をそのまま返す', async () => {
    const r = await resolveImageSource('https://cdn.discordapp.com/x.png', 'url', 100)
    expect(r.applied).toBe('url')
    expect(r.imageUrl).toBe('https://cdn.discordapp.com/x.png')
  })

  it('auto + 許可ホストは URL のまま（変換しない＝リサイズ対象外）', async () => {
    const r = await resolveImageSource('https://i.imgur.com/x.png', 'auto', 100)
    expect(r.applied).toBe('url')
    expect(r.imageUrl).toBe('https://i.imgur.com/x.png')
  })

  it('入力が data URI ならそのまま（変換なし）', async () => {
    const r = await resolveImageSource('data:image/png;base64,AAAA', 'auto', 100)
    expect(r.applied).toBe('dataUri')
    expect(r.imageUrl).toBe('data:image/png;base64,AAAA')
  })
})
