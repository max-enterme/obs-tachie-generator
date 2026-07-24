import { useEffect, useState } from 'react'
import UserForm from './ui/UserForm'
import UserList from './ui/UserList'
import OptionsPanel from './ui/OptionsPanel'
import OutputPanel from './ui/OutputPanel'
import { loadState, saveState } from './lib/state'
import type { GenerateOptions, TachieUser } from './lib/types'

export default function App() {
  const [users, setUsers] = useState<TachieUser[]>(() => loadState().users)
  const [options, setOptions] = useState<GenerateOptions>(() => loadState().options)

  useEffect(() => {
    saveState({ users, options })
  }, [users, options])

  function addUser(user: TachieUser) {
    setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
  }

  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <div className="app">
      <header>
        <h1>OBS 立ち絵ジェネレーター</h1>
        <p>
          Discord Streamkit 用のカスタムCSSを作ります。画像は data URI 埋め込み・常時表示（
          <code>body::after</code> + <code>:has()</code>）対応。
        </p>
      </header>

      <div className="layout">
        <div>
          <UserForm onAdd={addUser} />
          <div style={{ height: 16 }} />
          <OptionsPanel options={options} onChange={setOptions} />
        </div>
        <div>
          <UserList users={users} onRemove={removeUser} />
        </div>
      </div>

      <div style={{ height: 20 }} />
      <OutputPanel users={users} options={options} />
    </div>
  )
}
