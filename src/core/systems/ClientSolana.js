import { Transaction } from '@solana/web3.js'
import { System } from './System'
import { storage } from '../storage'
import bs58 from 'bs58'

const key = 'hyp:solana:auths'
const template = 'Connect to world:\n{address}'

export class ClientSolana extends System {
  constructor(world) {
    super(world)
    this.wallet = null
    this.modal = null
    this.auths = storage.get(key, []) // [...{ address, signature }]
    this.connected = false
  }

  async bind({ wallet, modal }) {
    this.wallet = wallet
    this.modal = modal
    if (this.wallet.connected && !this.connected) {
      const address = this.wallet.publicKey.toString()
      let auth = this.auths.find(auth => auth.address === address)
      if (!auth) {
        const text = template.replace('{address}', address)
        const message = new TextEncoder().encode(text)
        const signature_ = await this.wallet.signMessage(message)
        const signature = bs58.encode(signature_)
        auth = { address, signature }
        this.auths.push(auth)
        storage.set(key, this.auths)
      }
      this.connected = true
      this.world.network.send('walletConnect', auth)
    }
    if (!this.wallet.connected && this.connected) {
      this.connected = false
      this.world.network.send('walletDisconnect')
    }
  }

  connect(player) {
    if (player && player.data.id !== this.world.network.id) {
      throw new Error('[solana] cannot connect a remote player from client')
    }
    if (!this.wallet) return
    if (this.wallet.connected) return
    this.modal.setVisible(true)
  }

  disconnect(player) {
    if (player && player.data.id !== this.world.network.id) {
      throw new Error('[solana] cannot disconnect a remote player from client')
    }
    if (!this.wallet) return
    if (!this.wallet.connected) return
    this.wallet.disconnect()
  }

  deposit(playerId, amount) {
    throw new Error('[solana] deposit can only be called on the server')
  }

  withdraw(playerId, amount) {
    throw new Error('[solana] withdraw can only be called on the server')
  }

  async onDepositRequest({ depositId, serializedTx }) {
    // console.log('onDepositRequest', { depositId, serializedTx })
    const player = this.world.entities.player
    const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
    const signedTx = await player.wallet.signTransaction(tx)
    const serializedSignedTx = Buffer.from(signedTx.serialize()).toString('base64')
    this.world.network.send('depositResponse', { depositId, serializedSignedTx })
    // console.log('depositResponse', { depositId, serializedSignedTx })
  }

  async onWithdrawRequest({ withdrawId, serializedTx }) {
    // console.log('onWithdrawRequest', { withdrawId, serializedTx })
    const player = this.world.entities.player
    const tx = Transaction.from(Buffer.from(serializedTx, 'base64'))
    const signedTx = await player.wallet.signTransaction(tx)
    const serializedSignedTx = Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
    this.world.network.send('withdrawResponse', { withdrawId, serializedSignedTx })
    // console.log('withdrawResponse', { withdrawId, serializedSignedTx })
  }
}
