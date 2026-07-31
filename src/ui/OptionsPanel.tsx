import type { GenerateOptions } from '../lib/types'

interface Props {
  options: GenerateOptions
  onChange: (options: GenerateOptions) => void
}

/**
 * 見た目・演出の設定（位置とサイズ / 発話演出 / その他）。
 * 「個別・まとめ」の切替（旧 alwaysShow トグル）は出力ステップのモードカードへ移動したため、
 * このパネルには含めない。
 */
export default function OptionsPanel({ options, onChange }: Props) {
  function set<K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) {
    onChange({ ...options, [key]: value })
  }
  function setSpeak<K extends keyof GenerateOptions['speak']>(
    key: K,
    value: GenerateOptions['speak'][K],
  ) {
    onChange({ ...options, speak: { ...options.speak, [key]: value } })
  }

  return (
    <div className="panel">
      <div className="subhead">位置とサイズ</div>
      <div className="row">
        <div className="field">
          <label htmlFor="op-left">位置 left(px)</label>
          <input
            id="op-left"
            type="number"
            value={options.left}
            onChange={(e) => set('left', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="op-bottom">位置 bottom(px)</label>
          <input
            id="op-bottom"
            type="number"
            value={options.bottom}
            onChange={(e) => set('bottom', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="op-width">幅 width(px)・空で原寸</label>
          <input
            id="op-width"
            type="number"
            min={0}
            value={options.width ?? ''}
            onChange={(e) => {
              const v = e.target.value
              set('width', v === '' ? undefined : Number(v))
            }}
          />
        </div>
      </div>

      <div className="subhead">発話演出（話すと反応）</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '4px 0 8px' }}>
        話すときの動き（すべて OFF なら静止）
      </div>
      <div className="chips">
        <button
          type="button"
          className="chip"
          data-on={options.speak.bounce}
          aria-pressed={options.speak.bounce}
          onClick={() => setSpeak('bounce', !options.speak.bounce)}
        >
          <span className="dot" />
          ぴょこぴょこ
        </button>
        <button
          type="button"
          className="chip"
          data-on={options.speak.outline}
          aria-pressed={options.speak.outline}
          onClick={() => setSpeak('outline', !options.speak.outline)}
        >
          <span className="dot" />
          枠・後光
        </button>
        <button
          type="button"
          className="chip"
          data-on={options.speak.blink}
          aria-pressed={options.speak.blink}
          onClick={() => setSpeak('blink', !options.speak.blink)}
        >
          <span className="dot" />
          点滅
        </button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="op-jump">跳ね高さ(px)</label>
          <input
            id="op-jump"
            type="number"
            min={0}
            value={options.speak.jumpPx}
            disabled={!options.speak.bounce}
            onChange={(e) => setSpeak('jumpPx', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="op-dur">動きの速さ・周期(ms)</label>
          <input
            id="op-dur"
            type="number"
            min={50}
            value={options.speak.durationMs}
            onChange={(e) => setSpeak('durationMs', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="op-color">枠・後光の色</label>
          <input
            id="op-color"
            type="color"
            value={options.speak.outlineColor ?? '#FFFFFF'}
            disabled={!options.speak.outline}
            onChange={(e) => setSpeak('outlineColor', e.target.value)}
          />
        </div>
      </div>

      <div className="subhead">その他</div>
      <label className="toggle" htmlFor="op-dim">
        <input
          id="op-dim"
          type="checkbox"
          checked={options.dimWhenQuiet}
          onChange={(e) => set('dimWhenQuiet', e.target.checked)}
        />
        <span className="sw" />
        <span className="lab">
          静かな人を暗くする
          <small>発話していない立ち絵を暗く・話す人を目立たせる</small>
        </span>
      </label>

      <p className="hint" style={{ marginTop: 12 }}>
        常時表示・発話検知は CSS <code>:has()</code> を使います。古い OBS(CEF) では効かないことがあります。
      </p>
    </div>
  )
}
