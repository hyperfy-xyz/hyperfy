import { registerNode } from '@hyperfy/core/extras/createNode'
import { WebView } from './WebView'

export default function () {
  registerNode('webview', WebView)
}
