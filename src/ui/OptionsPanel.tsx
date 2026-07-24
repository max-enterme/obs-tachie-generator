import type { GenerateOptions } from '../lib/types'

interface Props {
  options: GenerateOptions
  onChange: (options: GenerateOptions) => void
}

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
      <h2>表示オプション</h2>

      <label className="checkbox" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={options.alwaysShow}
          onChange={(e) => set('alwaysShow', e.target.checked)}
        />
        常時表示（通話に居なくても出す／body::after・1人=1ソース）
      </label>

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

      <label className="checkbox" style={{ margin: '4px 0 12px' }}>
        <input
          type="checkbox"
          checked={options.speak.enabled}
          onChange={(e) => setSpeak('enabled', e.target.checked)}
        />
        発話演出を出す（:has() で発話検知）
      </label>

      <div className="row">
        <div className="field">
          <label htmlFor="op-jump">跳ね高さ(px)・0 でなし</label>
          <input
            id="op-jump"
            type="number"
            min={0}
            value={options.speak.jumpPx}
            disabled={!options.speak.enabled}
            onChange={(e) => setSpeak('jumpPx', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="op-dur">周期(ms)</label>
          <input
            id="op-dur"
            type="number"
            min={50}
            value={options.speak.durationMs}
            disabled={!options.speak.enabled}
            onChange={(e) => setSpeak('durationMs', Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.speak.whiteOutline}
              disabled={!options.speak.enabled}
              onChange={(e) => setSpeak('whiteOutline', e.target.checked)}
            />
            白フチ
          </label>
        </div>
      </div>

      <p className="hint">
        常時表示・発話検知は CSS <code>:has()</code> を使います。古い OBS(CEF) では効かないことがあります。
      </p>
    </div>
  )
}
