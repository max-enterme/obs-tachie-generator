import { useEffect, useState } from 'react'
import UserForm from './ui/UserForm'
import UserList from './ui/UserList'
import OptionsPanel from './ui/OptionsPanel'
import OutputPanel from './ui/OutputPanel'
import TachiePreview from './ui/TachiePreview'
import Stepper, { type StepDef } from './ui/Stepper'
import { loadState, saveState } from './lib/state'
import type { GenerateOptions, TachieUser } from './lib/types'

const STEPS: StepDef[] = [
  { key: 'ユーザー登録', desc: 'ID・名前・立ち絵' },
  { key: '見た目・演出', desc: '位置 / サイズ / 発話' },
  { key: 'プレビュー確認', desc: '貼る前にチェック' },
  { key: 'CSSを出力', desc: 'コピー / DL / 貼付' },
]

export default function App() {
  const [users, setUsers] = useState<TachieUser[]>(() => loadState().users)
  const [options, setOptions] = useState<GenerateOptions>(() => loadState().options)
  const [step, setStep] = useState(0)
  // 発話プレビューの再生状態は App で持つ（sticky 小 と ステップ③大 で共有）。
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    saveState({ users, options })
  }, [users, options])

  function addUser(user: TachieUser) {
    setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
  }

  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  function goto(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
  }

  return (
    <div className="app">
      <header>
        <h1>OBS 立ち絵ジェネレーター</h1>
        <p>Discord Streamkit 用のカスタムCSSを 4ステップで作成します。</p>
      </header>

      <Stepper steps={STEPS} current={step} onJump={goto} />

      <div className="work-grid">
        <div className="step-col">
          {step === 0 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">1</span>
                <div>
                  <h2>ユーザー登録</h2>
                  <p className="lead">
                    立ち絵を出したい人を登録します。Discord ユーザーID・表示名（メモ）・立ち絵画像。
                    画像はアップロードで <code>data URI</code> 埋め込み、または画像URL（許可ホストは
                    そのまま／他は自動で埋め込み）。
                  </p>
                </div>
              </div>
              <UserForm onAdd={addUser} />
              <UserList users={users} onRemove={removeUser} />
            </section>
          )}

          {step === 1 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">2</span>
                <div>
                  <h2>見た目・演出の設定</h2>
                  <p className="lead">
                    位置とサイズ、話したときの演出をまとめて設定します。変更は右のプレビューに即反映されます。
                  </p>
                </div>
              </div>
              <OptionsPanel options={options} onChange={setOptions} />
            </section>
          )}

          {step === 2 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">3</span>
                <div>
                  <h2>プレビューで確認</h2>
                  <p className="lead">
                    OBS に貼る前に、位置・サイズ・発話演出が思い通りか確認します。「発話プレビュー」で
                    動きを再生できます。
                  </p>
                </div>
              </div>
              <TachiePreview
                users={users}
                options={options}
                speaking={speaking}
                onSpeakingChange={setSpeaking}
                title="プレビュー（確認用・大）"
                toggleId="tp-speaking-full"
              />
            </section>
          )}

          {step === 3 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">4</span>
                <div>
                  <h2>CSS を出力して OBS に貼る</h2>
                  <p className="lead">
                    出力モードを選んでコピー / ダウンロードし、OBS のブラウザソースのカスタムCSSに貼ります。
                  </p>
                </div>
              </div>
              <OutputPanel users={users} options={options} onChange={setOptions} />
            </section>
          )}

          <div className="stepnav">
            <button
              className="ghost"
              onClick={() => goto(step - 1)}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              ← 戻る
            </button>
            <div className="spacer" />
            <span className="label">
              ステップ {step + 1} / {STEPS.length}
            </span>
            <button
              className="primary"
              onClick={() => goto(step + 1)}
              disabled={step === STEPS.length - 1}
            >
              次へ →
            </button>
          </div>
        </div>

        <aside className="preview-col">
          <TachiePreview
            users={users}
            options={options}
            speaking={speaking}
            onSpeakingChange={setSpeaking}
            title="プレビュー"
            toggleId="tp-speaking-sticky"
          />
        </aside>
      </div>
    </div>
  )
}
