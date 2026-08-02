export interface StepDef {
  /** 表示ラベル（例: ユーザー登録）。 */
  key: string
  /** 補足の一言（狭幅では隠れる）。 */
  desc: string
}

interface Props {
  steps: StepDef[]
  /** 現在のステップ（0 始まり）。 */
  current: number
  onJump: (index: number) => void
}

/** 番号付きステッパー。各タブは直接ジャンプ可能。 */
export default function Stepper({ steps, current, onJump }: Props) {
  return (
    <nav className="stepper" aria-label="手順">
      {steps.map((s, i) => (
        <button
          key={s.key}
          type="button"
          className={`step-tab${i < current ? ' done' : ''}`}
          aria-current={i === current ? 'step' : undefined}
          onClick={() => onJump(i)}
        >
          <span className="n">{i + 1}</span>
          <span className="t">
            <span className="k">{s.key}</span>
            <span className="d">{s.desc}</span>
          </span>
        </button>
      ))}
    </nav>
  )
}
