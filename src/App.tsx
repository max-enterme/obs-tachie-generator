import { useEffect, useState } from 'react'
import AppUserForm from './ui/AppUserForm'
import AppUserList from './ui/AppUserList'
import PresetPanel from './ui/PresetPanel'
import PairingPanel from './ui/PairingPanel'
import OutputPanel from './ui/OutputPanel'
import TachiePreview from './ui/TachiePreview'
import Stepper, { type StepDef } from './ui/Stepper'
import { loadState, saveState } from './lib/state'
import { makeDefaultPreset, newId, type AppUser, type Pairing, type Preset } from './lib/types'

const STEPS: StepDef[] = [
  { key: 'ユーザー', desc: 'Discord ID・名前' },
  { key: '立ち絵・演出', desc: 'プリセットを用意' },
  { key: '組み合わせ', desc: 'ペア＆プレビュー' },
  { key: '出力', desc: 'ペアごとに CSS' },
]

export default function App() {
  const [initial] = useState(loadState)
  const [users, setUsers] = useState<AppUser[]>(initial.users)
  const [presets, setPresets] = useState<Preset[]>(initial.presets)
  const [pairings, setPairings] = useState<Pairing[]>(initial.pairings)
  const [step, setStep] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  // プレビューに映すプリセット（②の編集中 / ③で選択中）。未指定なら先頭にフォールバック。
  const [focusPresetId, setFocusPresetId] = useState<string | null>(null)

  useEffect(() => {
    saveState({ users, presets, pairings })
  }, [users, presets, pairings])

  const focusedPreset =
    presets.find((p) => p.id === focusPresetId) ?? presets[0] ?? null

  // --- users ---
  function addUser(user: AppUser) {
    setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
  }
  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setPairings((prev) => prev.filter((p) => p.userId !== id))
  }

  // --- presets ---
  function addPreset() {
    const p = makeDefaultPreset(newId())
    setPresets((prev) => [...prev, p])
    setFocusPresetId(p.id)
  }
  function changePreset(next: Preset) {
    setPresets((prev) => prev.map((p) => (p.id === next.id ? next : p)))
  }
  function removePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id))
    setPairings((prev) => prev.filter((p) => p.presetId !== id))
    setFocusPresetId((cur) => (cur === id ? null : cur))
  }

  // --- pairings ---
  function addPairing(pair: Pairing) {
    setPairings((prev) => [...prev, pair])
  }
  function removePairing(index: number) {
    setPairings((prev) => prev.filter((_, i) => i !== index))
  }
  function changePairingUser(index: number, userId: string) {
    setPairings((prev) => prev.map((p, i) => (i === index ? { ...p, userId } : p)))
  }

  function goto(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
  }

  return (
    <div className="app">
      <header>
        <h1>OBS 立ち絵ジェネレーター</h1>
        <p>
          「誰（Discord ID）」と「見た目（立ち絵プリセット）」を別々に用意して、出力時に組み合わせます。
        </p>
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
                    立ち絵を出したい人（Discord ユーザーID＋表示名メモ）を登録します。
                    立ち絵画像はここでは持たせません（見た目はステップ②）。
                  </p>
                </div>
              </div>
              <AppUserForm onAdd={addUser} />
              <AppUserList users={users} onRemove={removeUser} />
            </section>
          )}

          {step === 1 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">2</span>
                <div>
                  <h2>立ち絵・演出（プリセット）</h2>
                  <p className="lead">
                    再利用する見た目を作ります。立ち絵画像＋位置/サイズ＋発話演出を1セットに。
                    複数作って使い分けられます。変更は右のプレビューに即反映されます。
                  </p>
                </div>
              </div>
              <PresetPanel
                presets={presets}
                editingId={focusedPreset?.id ?? null}
                onSelect={setFocusPresetId}
                onAdd={addPreset}
                onRemove={removePreset}
                onChange={changePreset}
              />
            </section>
          )}

          {step === 2 && (
            <section className="step-panel">
              <div className="step-head">
                <span className="step-num">3</span>
                <div>
                  <h2>組み合わせ & プレビュー</h2>
                  <p className="lead">
                    ユーザーとプリセットを選んでペアを作ります。出力はペアごとに 1 ソース。
                    貼る前にプレビューで確認できます。
                  </p>
                </div>
              </div>
              <PairingPanel
                users={users}
                presets={presets}
                pairings={pairings}
                onAdd={addPairing}
                onRemove={removePairing}
                onChangeUser={changePairingUser}
                onFocusPreset={setFocusPresetId}
              />
              <TachiePreview
                preset={focusedPreset}
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
                    ペアごとの CSS をコピー / ダウンロードし、OBS のブラウザソース（1ペア=1ソース）の
                    カスタムCSSに貼ります。
                  </p>
                </div>
              </div>
              <OutputPanel users={users} presets={presets} pairings={pairings} />
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
            preset={focusedPreset}
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
