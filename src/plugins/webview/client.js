import { registerNode } from '@hyperfy/core/extras/createNode'
import { WebView } from './WebView'
import { ClientCSS } from './ClientCSS'

export default function (world) {
  registerNode('webview', WebView)
  world.register('css', ClientCSS)
}
