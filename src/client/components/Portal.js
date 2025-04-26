import { createPortal } from 'react-dom'

export function Portal({ children }) {
  return createPortal(children, document.getElementById('core-ui-portal'))
}
