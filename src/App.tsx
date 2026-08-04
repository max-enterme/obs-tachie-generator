import { useEffect, useState } from 'react'
import AppUserForm from './ui/AppUserForm'
import AppUserList from './ui/AppUserList'
import PresetPanel from './ui/PresetPanel'
import CombinePanel from './ui/CombinePanel'
import OutputPanel from './ui/OutputPanel'
import TachiePreview from './ui/TachiePreview'
import Stepper, { type StepDef } from './ui/Stepper'
import { useImageNaturalWidth } from './ui/useImageNaturalWidth'
import { loadState, saveState } from './lib/state'
import {
  makeDefaultPreset,
  newId,
  resolveDisplayName,
  type AppUser,
  type Pairing,
  type Preset,
  type Selection,
} from './lib/types'

const STEPS: StepDef[] = [
  { key: 'ユーザー', desc: 'Discord ID・名前' },
  { key: '立ち絵・演出', desc: 'プリセットを用意' },
  { key: '組み合わせ & 出力', desc: '選んで CSS を出す' },
]

export default function App() {
  const [initial] = useState(loadState)
  const [users, setUsers] = useState<AppUser[]>(initial.users)
  const [presets, setPresets] = useState<Preset[]>(initial.presets)
  const [pairings, setPairings] = useState<Pairing[]>(initial.pairings)
  const [selection, setSelection] = useState<Selection>(initial.selection)
  const [step, setStep] = useState(0)
  // ②で編集中のプリセット（下段プレビュー用）。未指定なら先頭にフォールバック。
  const [focusPresetId, setFocusPresetId] = useState<string | null>(null)

  useEffect(() => {
    saveState({ users, presets, pairings, selection })
  }, [users, presets, pairings, selection])

  const focusedPreset = presets.find((p) => p.id === focusPresetId) ?? presets[0] ?? null

  // 作業中選択の有効値（明示選択が無ければ先頭にフォールバック）。
  const effUserId =
    selection.userId && users.some((u) => u.id === selection.userId)
      ? selection.userId
      : users[0]?.id ?? null
  const effPresetId =
    selection.presetId && presets.some((p) => p.id === selection.presetId)
      ? selection.presetId
      : presets[0]?.id ?? null
  const selectedUser = users.find((u) => u.id === effUserId) ?? null
  const selectedPreset = presets.find((p) => p.id === effPresetId) ?? null
  // ②のプレビュー用の名前。プリセット単体は「誰」を持たないので、選択中（無ければ先頭）の
  // ユーザーの名前を仮に当てる（誰も居なければ TachiePreview 側の仮名にフォールバック）。
  const sampleNameText = selectedUser ? resolveDisplayName(selectedUser) : ''
  // 幅が原寸のプリセットでも名前の行揃えを使えるよう、画像の実サイズを測っておく。
  const focusedNaturalW = useImageNaturalWidth(focusedPreset?.imageUrl)
  const selectedNaturalW = useImageNaturalWidth(selectedPreset?.imageUrl)

  // --- users ---
  function addUser(user: AppUser) {
    setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
  }
  function changeUser(next: AppUser) {
    setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)))
  }
  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    setPairings((prev) => prev.filter((p) => p.userId !== id))
    setSelection((s) => (s.userId === id ? { ...s, userId: null } : s))
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
    setSelection((s) => (s.presetId === id ? { ...s, presetId: null } : s))
  }

  // --- selection & saved pairings ---
  function selectUser(userId: string) {
    setSelection((s) => ({ ...s, userId }))
  }
  function selectPreset(presetId: string) {
    setSelection((s) => ({ ...s, presetId }))
  }
  function saveSelection() {
    if (effUserId == null || effPresetId == null) return
    setPairings((prev) =>
      prev.some((p) => p.userId === effUserId && p.presetId === effPresetId)
        ? prev
        : [...prev, { userId: effUserId, presetId: effPresetId }],
    )
  }
  function recallPairing(pair: Pairing) {
    setSelection({ userId: pair.userId, presetId: pair.presetId })
  }
  function removePairing(index: number) {
    setPairings((prev) => prev.filter((_, i) => i !== index))
  }

  function goto(next: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)))
  }

  return (
    <div className="app">
      <header>
        <h1>OBS 立ち絵ジェネレーター</h1>
        <p>
          「誰（Discord ID）」と「見た目（立ち絵プリセット）」を別々に用意して、選んだ1組を出力します。
        </p>
      </header>

      <Stepper steps={STEPS} current={step} onJump={goto} />

      <div className="work">
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
            <AppUserList users={users} onRemove={removeUser} onChange={changeUser} />
          </section>
        )}

        {step === 1 && (
          <section className="step-panel">
            <div className="step-head">
              <span className="step-num">2</span>
              <div>
                <h2>立ち絵・演出（プリセット）</h2>
                <p className="lead">
                  再利用する見た目を作ります。立ち絵画像（アップロード⇄URLの切替）＋位置/サイズ＋発話演出を
                  1セットに。変更は下のプレビューに即反映されます。
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
              imageNaturalWidth={focusedNaturalW}
            />
            <TachiePreview
              preset={focusedPreset}
              nameText={sampleNameText}
              sampleWhenEmpty
              title="プレビュー"
            />
          </section>
        )}

        {step === 2 && (
          <section className="step-panel">
            <div className="step-head">
              <span className="step-num">3</span>
              <div>
                <h2>組み合わせ & 出力</h2>
                <p className="lead">
                  ユーザーとプリセットを選ぶと、その1組の CSS が下に出ます。ユーザーを変えれば
                  IDだけ差し替わり、見た目は据え置き。よく使う組は「保存」で貯めて呼び戻せます。
                </p>
              </div>
            </div>
            <div className="combine-grid">
              <CombinePanel
                users={users}
                presets={presets}
                pairings={pairings}
                userId={effUserId}
                presetId={effPresetId}
                onSelectUser={selectUser}
                onSelectPreset={selectPreset}
                onSave={saveSelection}
                onRecall={recallPairing}
                onRemove={removePairing}
              />
              <TachiePreview
                preset={selectedPreset}
                nameText={selectedUser ? resolveDisplayName(selectedUser) : ''}
                title="プレビュー"
              />
            </div>
            <OutputPanel
              user={selectedUser}
              preset={selectedPreset}
              imageNaturalWidth={selectedNaturalW}
            />
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
    </div>
  )
}
