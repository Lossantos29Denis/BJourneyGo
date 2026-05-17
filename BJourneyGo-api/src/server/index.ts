import { runStartupChecks } from '../lib/startupChecks'
import { createApp } from './app'

const app = createApp()

const port = Number(process.env.PORT || 4000)

async function start() {
  try {
    await runStartupChecks()
  } catch (e: any) {
    console.error('Startup checks failed:', String(e))
    process.exit(1)
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${port}`)
  })
}

start()

export default app
