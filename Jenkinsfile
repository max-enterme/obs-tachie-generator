// obs-tachie-generator — .github/workflows/ci.yml の移植。
// 元: node 22 / typecheck -> lint -> vitest run -> build
// 元は push: branches ['**'] なので、Multibranch 側で全ブランチを拾う設定にする。
pipeline {
  agent {
    docker {
      image 'node:22-bookworm'
      args '-e HOME=/tmp -e npm_config_cache=/tmp/.npm'
    }
  }
  options {
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
    disableConcurrentBuilds(abortPrevious: true)
  }
  stages {
    stage('install')   { steps { sh 'npm ci' } }
    stage('typecheck') { steps { sh 'npm run typecheck' } }
    stage('lint')      { steps { sh 'npm run lint' } }
    stage('test')      { steps { sh 'npx vitest run' } }
    stage('build')     { steps { sh 'npm run build' } }
  }
  post { always { cleanWs() } }
}
