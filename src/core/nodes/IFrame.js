import { Node } from './Node'

export class IFrame extends Node {
  constructor(data = {}) {
    super()
    this.name = 'iframe'

    const defaults = {
      src: 'https://www.youtube.com/embed/t9hIB6indI4?autoplay=1&mute=1',
    }

    this.data = { ...defaults, ...data }
  }

  mount() {
    let ifrm = document.createElement('iframe')
    ifrm.setAttribute('src', this.data.src)
    ifrm.style.width = '360px'
    ifrm.style.height = '270px'
    ifrm.style.borderWidth = '0px'

    this.div = document.createElement('div')
    this.div.style.position = 'fixed'
    this.div.style.right = '0px'
    this.div.style.zIndex = '1000'
    this.div.appendChild(ifrm)
    document.body.appendChild(this.div)
  }

  unmount() {
    document.body.removeChild(this.div)
  }
}
