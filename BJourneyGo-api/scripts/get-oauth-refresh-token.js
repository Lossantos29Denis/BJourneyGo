#!/usr/bin/env node
/*
 Interactive helper to get a Gmail OAuth2 refresh token.

 Usage:
 1) Create OAuth credentials (OAuth client ID) in Google Cloud Console (Desktop app or Web app with redirect to http://localhost:PORT/callback).
 2) Set `SMTP_OAUTH_CLIENT_ID` and `SMTP_OAUTH_CLIENT_SECRET` in `.env` or paste when prompted.
 3) Run: `node scripts/get-oauth-refresh-token.js` and follow instructions.

 The script will open your browser, receive the callback on a local HTTP server,
 exchange the code for tokens and print the refresh token. You can choose to
 save it to your `.env` automatically.
*/

const dotenv = require('dotenv')
dotenv.config()

const http = require('http')
const { URL } = require('url')
const { exec } = require('child_process')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

function openUrl(url) {
  const plat = process.platform
  if (plat === 'win32') return exec(`start "" "${url.replace(/"/g, '\\"')}"`)
  if (plat === 'darwin') return exec(`open "${url}"`)
  return exec(`xdg-open "${url}"`)
}

async function main() {
  const clientId = process.env.SMTP_OAUTH_CLIENT_ID || await prompt('Enter OAuth Client ID: ')
  const clientSecret = process.env.SMTP_OAUTH_CLIENT_SECRET || await prompt('Enter OAuth Client Secret: ')
  const portEnv = process.env.OAUTH_HELPER_PORT || ''
  const port = portEnv ? Number(portEnv) : 3000
  const redirectPath = '/callback'
  const redirectUri = `http://localhost:${port}${redirectPath}`

  if (!clientId || !clientSecret) {
    console.error('Client ID and Client Secret are required.')
    process.exit(1)
  }

  // lazy import to avoid forcing it when not needed elsewhere
  const { OAuth2Client } = require('google-auth-library')
  const oclient = new OAuth2Client(clientId, clientSecret, redirectUri)

  const authUrl = oclient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://mail.google.com/'
    ],
    prompt: 'consent'
  })

  console.log('\nI will open your browser to request access. If the browser does not open, copy and paste this URL into your browser:\n')
  console.log(authUrl + '\n')

  try { openUrl(authUrl) } catch (e) { console.warn('Failed to open browser automatically, please open the URL above manually.') }

  // Start a small HTTP server to receive the code
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://localhost:${port}`)
      if (reqUrl.pathname !== redirectPath) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const code = reqUrl.searchParams.get('code')
      const error = reqUrl.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (error) {
        res.end(`<h1>OAuth failed</h1><p>${error}</p><p>Check the terminal for details.</p>`)
        console.error('OAuth error:', error)
        server.close()
        return
      }

      res.end('<h1>Authentication successful</h1><p>You can close this tab and return to the terminal.</p>')
      server.close()

      if (!code) {
        console.error('No code received')
        process.exit(1)
      }

      console.log('Received code, exchanging for tokens...')
      const r = await oclient.getToken(code)
      const tokens = r.tokens || r

      console.log('\nTokens received:')
      console.log(JSON.stringify(tokens, null, 2))

      const refreshToken = tokens.refresh_token
      if (!refreshToken) {
        console.warn('\nNo refresh token returned. Make sure you used `access_type=offline` and `prompt=consent` and you have not previously consented to this client for this account.')
      } else {
        console.log('\nRefresh token:')
        console.log(refreshToken)
      }

      // Offer to save to .env
      const save = (await prompt('\nSave refresh token to .env as SMTP_OAUTH_REFRESH_TOKEN? (y/N): ')).toLowerCase()
      if (save === 'y' || save === 'yes') {
        const envPath = path.resolve(process.cwd(), '.env')
        let env = ''
        try { env = fs.readFileSync(envPath, 'utf8') } catch (e) { env = '' }

        const key = 'SMTP_OAUTH_REFRESH_TOKEN'
        const line = `${key}=${refreshToken}`
        if (env.includes(`${key}=`)) {
          // replace existing
          env = env.replace(new RegExp(`${key}=.*`), line)
        } else {
          if (env.length && !env.endsWith('\n')) env += '\n'
          env += line + '\n'
        }
        fs.writeFileSync(envPath, env, 'utf8')
        console.log('Saved refresh token to', envPath)
      }

      process.exit(0)
    } catch (err) {
      console.error('Error handling OAuth callback:', err)
      res.writeHead(500)
      res.end('Internal Server Error')
      server.close()
      process.exit(1)
    }
  })

  server.listen(port, () => console.log(`Listening for OAuth callback on http://localhost:${port}${redirectPath}`))

  // If the user prefers not to open a local server, show a fallback prompt with the URL
  const fallback = (await prompt('\nIf you prefer not to use the local callback server, press ENTER to continue and then copy the code parameter from the redirect URL into the terminal. Or type "server" to wait for the local callback server (default: server): ')).trim()
  if (fallback && fallback.toLowerCase() !== 'server') {
    // Manual: user will paste code
    try {
      const code = await prompt('Paste the `code` query parameter value here: ')
      server.close()
      console.log('Exchanging code...')
      const r = await oclient.getToken(code)
      const tokens = r.tokens || r
      console.log('\nTokens received:')
      console.log(JSON.stringify(tokens, null, 2))
      const refreshToken = tokens.refresh_token
      if (refreshToken) console.log('\nRefresh token:', refreshToken)
    } catch (e) {
      console.error('Failed to exchange code:', e)
      process.exit(1)
    }
  }
}

void main()
