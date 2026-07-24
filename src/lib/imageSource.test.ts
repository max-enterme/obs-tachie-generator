import { describe, expect, it } from 'vitest'
import { isDataUri, isStreamkitAllowedImageUrl } from './imageSource'

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
