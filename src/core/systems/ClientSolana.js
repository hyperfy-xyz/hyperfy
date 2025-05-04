import { Transaction } from '@solana/web3.js'
import { System } from './System'

export class ClientSolana extends System {
  constructor(world) {
    super(world)
  }

  connect() {
    const player = this.world.entities.player
    if (player.wallet.connected) return console.warn('[solana] already connected')
    player.wallet.openModal()
  }

  disconnect() {
    const player = this.world.entities.player
    if (!player.wallet.connected) return console.warn('[solana] already disconnected')
    player.wallet.disconnect()
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
