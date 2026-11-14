// Google Identity Services in the browser: loads the GIS script on demand and
// renders the "Sign in with Google" button. Browser-only.
//
// The legacy site put the script tag in every page; it is now loaded only
// when someone opens the login dialog, so logged-out pages make no request to
// Google. The production CSP allows the script, its stylesheet, its button
// iframe and its connections (see server.js).

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface CredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    context?: 'signin' | 'signup' | 'use'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null

const loadScript = (): Promise<GoogleAccountsId> =>
  (scriptPromise ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else reject(new Error('Google Identity Services did not initialise'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('Could not load Google Identity Services'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    // Let a later attempt try again.
    scriptPromise = null
    throw error
  }))

// GIS keeps one configuration per page; the callback is swapped per call so
// it always reaches the component that rendered the latest button.
let initialisedFor: string | null = null
let onCredential: (credential: string) => void = () => {}

/**
 * Renders the Google sign-in button into `parent` (the same look as the
 * legacy site: standard, rectangular, filled_black, medium, "Sign in with")
 * and calls `callback` with the ID token after a successful sign-in.
 */
export const renderGoogleSignInButton = async (
  parent: HTMLElement,
  clientId: string,
  callback: (credential: string) => void,
): Promise<void> => {
  const id = await loadScript()
  onCredential = callback
  if (initialisedFor !== clientId) {
    id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
      ux_mode: 'popup',
      context: 'signin',
      auto_select: false,
    })
    initialisedFor = clientId
  }
  id.renderButton(parent, {
    type: 'standard',
    shape: 'rectangular',
    theme: 'filled_black',
    text: 'signin_with',
    size: 'medium',
    logo_alignment: 'left',
  })
}
